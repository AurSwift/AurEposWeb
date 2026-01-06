import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { db } from "@/lib/db";
import { subscriptions, subscriptionChanges } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  publishSubscriptionReactivated,
  getLicenseKeysForSubscription,
} from "@/lib/subscription-events";
import { requireAuth } from "@/lib/api/auth-helpers";
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";
import {
  successResponse,
  handleApiError,
  ValidationError,
} from "@/lib/api/response-helpers";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { subscriptionId } = await request.json();

    if (!subscriptionId) {
      throw new ValidationError("Subscription ID is required");
    }

    const customer = await getCustomerOrThrow(session.user.id);

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
      throw new ValidationError("Subscription not found");
    }

    // Check if subscription is eligible for reactivation
    if (!subscription.cancelAtPeriodEnd) {
      throw new ValidationError("Subscription is not scheduled for cancellation");
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

    return successResponse({
      success: true,
      message: "Subscription reactivated successfully",
    });
  } catch (error) {
    return handleApiError(error, "Failed to reactivate subscription");
  }
}
