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

    // Cancel in Stripe - Best Practice: Preserve trial access
    if (cancelImmediately && !isInTrial) {
      // Only allow immediate cancellation for paid subscriptions
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    } else {
      // During trial OR scheduled cancellation: cancel at period end
      // This ensures users get full value of their trial/billing period
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }

    // Determine effective cancellation behavior
    const effectivelyImmediate = cancelImmediately && !isInTrial;

    // Update database in a transaction
    await db.transaction(async (tx) => {
      // Update subscription
      await tx
        .update(subscriptions)
        .set({
          cancelAtPeriodEnd: !effectivelyImmediate,
          canceledAt: effectivelyImmediate ? new Date() : null,
          status: effectivelyImmediate ? "canceled" : subscription.status,
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
          (effectivelyImmediate
            ? "Immediate cancellation"
            : isInTrial
            ? "Cancelled during trial - access preserved until trial end"
            : "Cancel at period end"),
        effectiveDate: effectivelyImmediate
          ? new Date()
          : subscription.trialEnd ||
            subscription.currentPeriodEnd ||
            new Date(),
        metadata: {
          cancelImmediately,
          effectivelyImmediate,
          isInTrial,
          canceledBy: session.user.id,
          trialEndDate: subscription.trialEnd,
          trialAccessPreserved: isInTrial && cancelImmediately, // User requested immediate but we preserved trial
        },
      });

      // Revoke license keys only if truly immediate (not during trial)
      if (effectivelyImmediate) {
        await tx
          .update(licenseKeys)
          .set({
            isActive: false,
            revokedAt: new Date(),
            revocationReason: "Subscription cancelled immediately",
          })
          .where(eq(licenseKeys.subscriptionId, subscriptionId));
      }
    });

    // 🔔 SSE: Notify desktop apps about cancellation (after transaction commits)
    const licenseKeysList = await getLicenseKeysForSubscription(subscriptionId);

    // Calculate grace period end based on cancellation type using helper
    const gracePeriodEnd = effectivelyImmediate
      ? calculatePaidCancellationGracePeriod(subscription, new Date())
      : isInTrial
      ? calculateTrialCancellationGracePeriod(subscription, new Date())
      : calculatePaidCancellationGracePeriod(subscription, new Date());

    for (const key of licenseKeysList) {
      publishSubscriptionCancelled(key, {
        cancelledAt: new Date(),
        cancelImmediately: effectivelyImmediate,
        gracePeriodEnd,
        reason:
          reason ||
          (effectivelyImmediate
            ? "Immediate cancellation"
            : isInTrial
            ? "Cancelled during trial - access preserved until trial end"
            : "Cancel at period end"),
      });
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
        accessEndDate: effectivelyImmediate
          ? new Date() // Truly immediate (paid subscription only)
          : isInTrial
          ? subscription.trialEnd || new Date()
          : subscription.currentPeriodEnd || new Date(),
        wasInTrial: isInTrial || false,
        exportDataUrl: `${process.env.NEXTAUTH_URL}/dashboard/export`,
      }).catch((error) => {
        console.error("Failed to send cancellation confirmation email:", error);
      });
    }

    // Return appropriate message based on what actually happened
    let responseMessage: string;
    if (isInTrial && cancelImmediately) {
      // User requested immediate, but we preserved trial - explain why
      responseMessage = `We understand you want to cancel. To ensure you get full value of your trial, we've preserved your access until ${subscription.trialEnd?.toLocaleDateString()}. After that, you'll have a 7-day grace period to export your data.`;
    } else if (effectivelyImmediate) {
      // Truly immediate cancellation (paid subscription)
      responseMessage =
        "Subscription cancelled immediately. You have a 7-day grace period to export your data.";
    } else if (isInTrial) {
      // Normal trial cancellation
      responseMessage = `Your trial will remain active until ${subscription.trialEnd?.toLocaleDateString()}. After that, you'll have a 7-day grace period.`;
    } else {
      // Scheduled cancellation at period end
      responseMessage = `Subscription will cancel at the end of the billing period on ${subscription.currentPeriodEnd?.toLocaleDateString()}. You'll have a 7-day grace period after that.`;
    }

    return successResponse({
      success: true,
      message: responseMessage,
      cancelledImmediately: effectivelyImmediate,
      trialAccessPreserved: isInTrial && cancelImmediately,
      isInTrial,
      accessUntil: effectivelyImmediate
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
