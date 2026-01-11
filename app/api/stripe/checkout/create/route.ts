import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { stripe } from "@/lib/stripe/client";
import { getStripePriceId } from "@/lib/stripe/plans";
import { db } from "@/lib/db";
import { customers, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { PlanId, BillingCycle } from "@/lib/stripe/plans";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { planId, billingCycle, email } = (await request.json()) as {
      planId: PlanId;
      billingCycle: BillingCycle;
      email?: string;
    };

    if (!planId || !billingCycle) {
      return NextResponse.json(
        { error: "Plan ID and billing cycle are required" },
        { status: 400 }
      );
    }

    // Validate plan ID
    if (!["basic", "professional"].includes(planId)) {
      return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 });
    }

    let customer;
    let userId: string;

    // If user is authenticated, use their session
    if (session?.user?.id) {
      // IMPORTANT: Only customers can checkout - internal users cannot
      if (session.user.role !== "customer") {
        return NextResponse.json(
          { error: "Only customer accounts can purchase subscriptions" },
          { status: 403 }
        );
      }

      userId = session.user.id;
      const [customerRecord] = await db
        .select()
        .from(customers)
        .where(eq(customers.userId, userId))
        .limit(1);

      if (!customerRecord) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 }
        );
      }
      customer = customerRecord;
    } else if (email) {
      // If not authenticated but email provided, verify email is verified and get user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      if (!user.emailVerified) {
        return NextResponse.json(
          { error: "Email must be verified before checkout" },
          { status: 403 }
        );
      }

      // Only customers can checkout - internal users cannot
      if (user.role !== "customer") {
        return NextResponse.json(
          { error: "Only customer accounts can purchase subscriptions" },
          { status: 403 }
        );
      }

      userId = user.id;
      const [customerRecord] = await db
        .select()
        .from(customers)
        .where(eq(customers.userId, userId))
        .limit(1);

      if (!customerRecord) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 }
        );
      }
      customer = customerRecord;
    } else {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in or provide verified email." },
        { status: 401 }
      );
    }

    // Get Stripe price ID
    const priceId = await getStripePriceId(planId, billingCycle);

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
          userId: userId,
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
        userId: userId,
        planId,
        billingCycle,
      },
      subscription_data: {
        metadata: {
          customerId: customer.id,
          userId: userId,
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
