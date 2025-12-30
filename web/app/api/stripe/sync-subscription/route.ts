import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { stripe } from "@/lib/stripe/client";
import { db } from "@/lib/db";
import { customers, subscriptions, licenseKeys } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getPlan } from "@/lib/stripe/plans";
import { generateLicenseKey } from "@/lib/license/generator";

/**
 * POST /api/stripe/sync-subscription
 * Manually syncs subscription from Stripe (for local development when webhooks don't work)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await request.json();
    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID required" },
        { status: 400 }
      );
    }

    // Get customer
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

    // Retrieve checkout session from Stripe
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (!checkoutSession.subscription) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      );
    }

    const stripeSubscription =
      typeof checkoutSession.subscription === "string"
        ? await stripe.subscriptions.retrieve(checkoutSession.subscription)
        : checkoutSession.subscription;

    // Check if subscription already exists
    const [existingSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscription.id))
      .limit(1);

    if (existingSub) {
      return NextResponse.json({
        message: "Subscription already synced",
        subscription: existingSub,
      });
    }

    // Get plan details from metadata
    const planId = (checkoutSession.metadata?.planId || "basic") as any;
    const billingCycle = (checkoutSession.metadata?.billingCycle ||
      "monthly") as any;

    const plan = await getPlan(planId);
    const price =
      billingCycle === "monthly" ? plan.priceMonthly : plan.priceAnnual;

    // Create subscription
    const [newSubscription] = await db
      .insert(subscriptions)
      .values({
        customerId: customer.id,
        planId,
        planType: planId,
        billingCycle,
        price: price.toString(),
        status:
          stripeSubscription.status === "trialing" ? "trialing" : "active",
        currentPeriodStart: new Date(
          stripeSubscription.current_period_start * 1000
        ),
        currentPeriodEnd: new Date(
          stripeSubscription.current_period_end * 1000
        ),
        nextBillingDate: new Date(stripeSubscription.current_period_end * 1000),
        trialStart: stripeSubscription.trial_start
          ? new Date(stripeSubscription.trial_start * 1000)
          : null,
        trialEnd: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
        autoRenew: !stripeSubscription.cancel_at_period_end,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: stripeSubscription.customer as string,
        metadata: {
          stripePriceId: stripeSubscription.items.data[0].price.id,
        },
      })
      .returning();

    // Generate and store license key using proper generator
    const licenseKeyValue = generateLicenseKey(plan.id, customer.id);

    // Create license key
    await db.insert(licenseKeys).values({
      customerId: customer.id,
      subscriptionId: newSubscription.id,
      licenseKey: licenseKeyValue,
      maxTerminals: plan.features.maxTerminals,
      activationCount: 0,
      version: "2.0",
      issuedAt: new Date(),
      isActive: true,
    });

    return NextResponse.json({
      message: "Subscription synced successfully",
      subscription: newSubscription,
      licenseKey: licenseKeyValue,
    });
  } catch (error) {
    console.error("Sync subscription error:", error);
    return NextResponse.json(
      { error: "Failed to sync subscription" },
      { status: 500 }
    );
  }
}
