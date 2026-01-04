import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { subscriptions, customers, subscriptionChanges } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  publishSubscriptionReactivated,
  getLicenseKeysForSubscription,
} from "@/lib/subscription-events";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { subscriptionId } = await request.json();

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "Subscription ID is required" },
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

    // Get subscription
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.id, subscriptionId),
          eq(subscriptions.customerId, customer.id)
        )
      )
      .limit(1);

    if (!subscription || !subscription.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    // Check if subscription is eligible for reactivation
    if (!subscription.cancelAtPeriodEnd) {
      return NextResponse.json(
        { error: "Subscription is not scheduled for cancellation" },
        { status: 400 }
      );
    }

    // Reactivate in Stripe
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    // Update database in a transaction
    await db.transaction(async (tx) => {
      // Update subscription
      await tx
        .update(subscriptions)
        .set({
          cancelAtPeriodEnd: false,
          canceledAt: null,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscriptionId));

      // Record change
      await tx.insert(subscriptionChanges).values({
        subscriptionId,
        customerId: customer.id,
        changeType: "reactivation",
        reason: "Subscription reactivated by customer",
        effectiveDate: new Date(),
        metadata: {
          reactivatedBy: session.user.id,
        },
      });
    });

    // 🔔 SSE: Notify desktop apps about reactivation (after transaction commits)
    const licenseKeysList = await getLicenseKeysForSubscription(subscriptionId);

    for (const key of licenseKeysList) {
      publishSubscriptionReactivated(key, {
        subscriptionStatus: "active",
        planId: subscription.planId || "basic",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Subscription reactivated successfully",
    });
  } catch (error) {
    console.error("Subscription reactivation error:", error);
    return NextResponse.json(
      {
        error: "Failed to reactivate subscription",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
