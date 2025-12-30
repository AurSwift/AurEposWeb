import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { stripe } from "@/lib/stripe/client";
import { getStripePriceId, getPlan } from "@/lib/stripe/plans";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { PlanId, BillingCycle } from "@/lib/stripe/plans";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId, billingCycle } = (await request.json()) as {
      planId: PlanId;
      billingCycle: BillingCycle;
    };

    if (!planId || !billingCycle) {
      return NextResponse.json(
        { error: "Plan ID and billing cycle are required" },
        { status: 400 }
      );
    }

    // Validate plan ID
    if (!["basic", "professional", "enterprise"].includes(planId)) {
      return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 });
    }

    // Get customer record
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, session.user.id))
      .limit(1);

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Get Stripe price ID
    const priceId = await getStripePriceId(planId, billingCycle);
    const plan = await getPlan(planId);

    // Create or get Stripe customer
    let stripeCustomerId: string;

    if (customer.stripeCustomerId) {
      stripeCustomerId = customer.stripeCustomerId;
    } else {
      const stripeCustomer = await stripe.customers.create({
        email: customer.email,
        name: customer.companyName || undefined,
        metadata: {
          customerId: customer.id,
          userId: session.user.id,
        },
      });
      stripeCustomerId = stripeCustomer.id;

      // Update customer with Stripe ID
      await db
        .update(customers)
        .set({ stripeCustomerId: stripeCustomer.id })
        .where(eq(customers.id, customer.id));
    }

    // Calculate trial period (7 days for monthly, 14 days for annual)
    const trialPeriodDays = billingCycle === "annual" ? 14 : 7;

    // Create Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/signup?canceled=true&plan=${planId}`,
      metadata: {
        customerId: customer.id,
        userId: session.user.id,
        planId,
        billingCycle,
      },
      subscription_data: {
        metadata: {
          customerId: customer.id,
          planId,
          billingCycle,
        },
        trial_period_days: trialPeriodDays,
      },
      allow_promotion_codes: true, // Allow discount codes
    });

    return NextResponse.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

