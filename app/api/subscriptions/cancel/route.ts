import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { db } from "@/lib/db";
import {
  subscriptions,
  licenseKeys,
  subscriptionChanges,
  users,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  publishSubscriptionCancelled,
  publishLicenseRevoked,
  getLicenseKeysForSubscription,
} from "@/lib/subscription-events";
import { sendCancellationConfirmationEmail } from "@/lib/emails/trial-notifications";
import { requireAuth } from "@/lib/api/auth-helpers";
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";
import {
  successResponse,
  handleApiError,
  ValidationError,
} from "@/lib/api/response-helpers";
import {
  calculateTrialCancellationGracePeriod,
  calculatePaidCancellationGracePeriod,
} from "@/lib/subscription/grace-period-helpers";

/**
 * POST /api/subscriptions/cancel
 *
 * Cancel a user's subscription (does NOT delete the customer account)
 *
 * IMPORTANT: This endpoint only cancels the subscription in Stripe and updates
 * the subscription status in the database. It does NOT delete the customer.
 * Customer deletion only happens when:
 * 1. An admin explicitly deletes the customer in Stripe dashboard
 * 2. Stripe sends a customer.deleted webhook event
 *
 * The customer account remains active with status="active" to allow:
 * - Viewing billing history
 * - Accessing the billing portal
 * - Reactivating the subscription
 * - Exporting data during grace period
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { subscriptionId, cancelImmediately, reason } = await request.json();

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

    // Check if subscription is in trial period
    const now = new Date();
    const isInTrial =
      subscription.status === "trialing" &&
      subscription.trialEnd &&
      subscription.trialEnd > now;

    // Implement proper cancellation based on user's choice
    if (cancelImmediately) {
      // IMMEDIATE CANCELLATION - Cancel NOW in Stripe (for both trial and paid)
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    } else {
      // CANCEL AT PERIOD END - Keep access until trial/billing period ends
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }

    // Update database in a transaction
    // NOTE: This updates ONLY the subscription, NOT the customer
    // Customer status remains "active" to allow portal access and reactivation
    await db.transaction(async (tx) => {
      // Update subscription
      await tx
        .update(subscriptions)
        .set({
          cancelAtPeriodEnd: !cancelImmediately,
          canceledAt: cancelImmediately ? new Date() : null,
          status: cancelImmediately ? "canceled" : subscription.status,
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
          : subscription.trialEnd ||
            subscription.currentPeriodEnd ||
            new Date(),
        metadata: {
          cancelImmediately,
          isInTrial,
          canceledBy: session.user.id,
          trialEndDate: subscription.trialEnd,
        },
      });

      // Revoke license keys ONLY if immediate cancellation
      if (cancelImmediately) {
        await tx
          .update(licenseKeys)
          .set({
            isActive: false,
            revokedAt: new Date(),
            revocationReason:
              cancelImmediately && isInTrial
                ? "Trial cancelled immediately"
                : "Subscription cancelled immediately",
          })
          .where(eq(licenseKeys.subscriptionId, subscriptionId));
      }
    });

    // 🔔 SSE: Notify desktop apps about cancellation (after transaction commits)
    const licenseKeysList = await getLicenseKeysForSubscription(subscriptionId);

    // Calculate grace period end based on cancellation type
    const gracePeriodEnd = cancelImmediately
      ? isInTrial
        ? calculateTrialCancellationGracePeriod(subscription, new Date())
        : calculatePaidCancellationGracePeriod(subscription, new Date())
      : isInTrial
      ? calculateTrialCancellationGracePeriod(subscription, new Date())
      : calculatePaidCancellationGracePeriod(subscription, new Date());

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

      // 🔔 CRITICAL: Send license revocation event for immediate cancellations
      // This ensures desktop app receives dual notification for immediate shutdown
      if (cancelImmediately) {
        publishLicenseRevoked(key, {
          reason: isInTrial
            ? "Trial cancelled immediately - license revoked"
            : "Subscription cancelled immediately - license revoked",
        });
      }
    }

    // Send cancellation confirmation email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (user?.email) {
      // Fire and forget - don't block response on email
      sendCancellationConfirmationEmail({
        email: user.email,
        userName: user.name || undefined,
        planName: subscription.planType || "Basic Plan",
        accessEndDate: cancelImmediately
          ? new Date() // Immediate cancellation - access ends now
          : isInTrial
          ? subscription.trialEnd || new Date()
          : subscription.currentPeriodEnd || new Date(),
        wasInTrial: isInTrial || false,
        cancelImmediately,
        exportDataUrl: `${process.env.NEXTAUTH_URL}/dashboard/export`,
      }).catch((error) => {
        console.error("Failed to send cancellation confirmation email:", error);
      });
    }

    // Return appropriate message based on what actually happened
    let responseMessage: string;
    if (cancelImmediately) {
      // True immediate cancellation
      if (isInTrial) {
        responseMessage =
          "Trial cancelled immediately. Your access has ended. You have a 7-day grace period to export your data.";
      } else {
        responseMessage =
          "Subscription cancelled immediately. Your access has ended. You have a 7-day grace period to export your data.";
      }
    } else {
      // Scheduled cancellation at period end
      if (isInTrial) {
        responseMessage = `Your trial will remain active until ${subscription.trialEnd?.toLocaleDateString()}. After that, you'll have a 7-day grace period to export your data.`;
      } else {
        responseMessage = `Subscription will cancel at the end of the billing period on ${subscription.currentPeriodEnd?.toLocaleDateString()}. You'll have a 7-day grace period after that.`;
      }
    }

    return successResponse({
      success: true,
      message: responseMessage,
      cancelledImmediately: cancelImmediately,
      isInTrial,
      accessUntil: cancelImmediately
        ? new Date()
        : isInTrial
        ? subscription.trialEnd
        : subscription.currentPeriodEnd,
      gracePeriodEnd,
    });
  } catch (error) {
    return handleApiError(error, "Failed to cancel subscription");
  }
}
