import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  subscriptions,
  customers,
  licenseKeys,
  subscriptionChanges,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  publishSubscriptionCancelled,
  getLicenseKeysForSubscription,
} from "@/lib/subscription-events";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { subscriptionId, cancelImmediately, reason } = await request.json();

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

    // Cancel in Stripe
    if (cancelImmediately) {
      // Cancel immediately
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    } else {
      // Cancel at period end
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }

    // Update database in a transaction
    await db.transaction(async (tx) => {
      // Update subscription
      await tx
        .update(subscriptions)
        .set({
          cancelAtPeriodEnd: !cancelImmediately,
          canceledAt: cancelImmediately ? new Date() : null,
          status: cancelImmediately ? "cancelled" : subscription.status,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscriptionId));

      // Record change
      await tx.insert(subscriptionChanges).values({
        subscriptionId,
        customerId: customer.id,
        changeType: "cancellation",
        reason:
          reason ||
          (cancelImmediately
            ? "Immediate cancellation"
            : "Cancel at period end"),
        effectiveDate: cancelImmediately
          ? new Date()
          : subscription.currentPeriodEnd || new Date(),
        metadata: {
          cancelImmediately,
          canceledBy: session.user.id,
        },
      });

      // If immediate cancellation, revoke license keys
      if (cancelImmediately) {
        await tx
          .update(licenseKeys)
          .set({
            isActive: false,
            revokedAt: new Date(),
            revocationReason: "Subscription cancelled",
          })
          .where(eq(licenseKeys.subscriptionId, subscriptionId));
      }
    });

    // 🔔 SSE: Notify desktop apps about cancellation (after transaction commits)
    const licenseKeysList = await getLicenseKeysForSubscription(subscriptionId);
    const gracePeriodEnd = cancelImmediately
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days grace
      : subscription.currentPeriodEnd
      ? new Date(
          subscription.currentPeriodEnd.getTime() + 7 * 24 * 60 * 60 * 1000
        )
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    for (const key of licenseKeysList) {
      publishSubscriptionCancelled(key, {
        cancelledAt: new Date(),
        cancelImmediately,
        gracePeriodEnd,
        reason:
          reason ||
          (cancelImmediately
            ? "Immediate cancellation"
            : "Cancel at period end"),
      });
    }

    return NextResponse.json({
      success: true,
      message: cancelImmediately
        ? "Subscription cancelled immediately"
        : "Subscription will cancel at the end of the billing period",
    });
  } catch (error) {
    console.error("Subscription cancellation error:", error);
    return NextResponse.json(
      {
        error: "Failed to cancel subscription",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
