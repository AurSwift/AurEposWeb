import type { Subscription } from "@/lib/db/schema";

/**
 * Grace period types for different subscription scenarios
 */
export type GracePeriodType = "trial" | "cancellation" | "past_due" | "offline";

/**
 * Grace period durations in days
 */
export const GRACE_PERIOD_DAYS = {
  trial: 7, // 7 days after trial ends
  cancellation: 7, // 7 days after cancellation
  past_due: 3, // 3 days for payment failures
  offline: 7, // 7 days for offline/heartbeat grace
} as const;

/**
 * Calculate grace period end date
 * Centralizes all grace period logic for consistency
 *
 * @param type - Type of grace period
 * @param baseDate - The date to calculate from
 * @returns Date when grace period ends
 *
 * @example
 * // Calculate trial grace period end
 * const gracePeriodEnd = calculateGracePeriodEnd(
 *   "trial",
 *   subscription.trialEnd
 * );
 */
export function calculateGracePeriodEnd(
  type: GracePeriodType,
  baseDate: Date
): Date {
  const days = GRACE_PERIOD_DAYS[type];
  const gracePeriodEnd = new Date(baseDate);
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + days);

  return gracePeriodEnd;
}

/**
 * Check if currently within grace period
 *
 * @param gracePeriodEnd - When grace period ends
 * @param now - Current date (defaults to now)
 * @returns True if within grace period, false if expired
 */
export function isWithinGracePeriod(
  gracePeriodEnd: Date,
  now: Date = new Date()
): boolean {
  return now <= gracePeriodEnd;
}

/**
 * Calculate remaining time in grace period
 *
 * @param gracePeriodEnd - When grace period ends
 * @param now - Current date (defaults to now)
 * @returns Milliseconds remaining, or 0 if expired
 */
export function getGracePeriodRemaining(
  gracePeriodEnd: Date,
  now: Date = new Date()
): number {
  const remaining = gracePeriodEnd.getTime() - now.getTime();
  return Math.max(0, remaining);
}

/**
 * Calculate days remaining in grace period
 *
 * @param gracePeriodEnd - When grace period ends
 * @param now - Current date (defaults to now)
 * @returns Days remaining (rounded up), or 0 if expired
 */
export function getGracePeriodDaysRemaining(
  gracePeriodEnd: Date,
  now: Date = new Date()
): number {
  const remainingMs = getGracePeriodRemaining(gracePeriodEnd, now);
  return Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculate grace period for trial cancellation
 * Special handling for trial-specific scenarios
 *
 * @param subscription - Subscription data
 * @param cancelledAt - When subscription was cancelled
 * @returns Grace period end date
 */
export function calculateTrialCancellationGracePeriod(
  subscription: Subscription,
  cancelledAt: Date = new Date()
): Date {
  const now = new Date();

  // If in trial period, grace period starts from trial end
  const isInTrial =
    subscription.status === "trialing" &&
    subscription.trialEnd &&
    subscription.trialEnd > now;

  if (isInTrial && subscription.trialEnd) {
    return calculateGracePeriodEnd("trial", subscription.trialEnd);
  }

  // Otherwise, grace period starts from cancellation date
  return calculateGracePeriodEnd("cancellation", cancelledAt);
}

/**
 * Calculate grace period for paid subscription cancellation
 *
 * @param subscription - Subscription data
 * @param cancelledAt - When subscription was cancelled
 * @returns Grace period end date
 */
export function calculatePaidCancellationGracePeriod(
  subscription: Subscription,
  cancelledAt: Date = new Date()
): Date {
  // For paid subscriptions, grace period starts from current period end
  const periodEnd = subscription.currentPeriodEnd || cancelledAt;
  return calculateGracePeriodEnd("cancellation", periodEnd);
}

/**
 * Calculate grace period for past due subscription
 *
 * @param subscription - Subscription data
 * @returns Grace period end date
 */
export function calculatePastDueGracePeriod(subscription: Subscription): Date {
  const lastPaymentAttempt = subscription.currentPeriodEnd || new Date();
  return calculateGracePeriodEnd("past_due", lastPaymentAttempt);
}

/**
 * Get appropriate grace period end for subscription status
 * Automatically determines correct grace period based on subscription state
 *
 * @param subscription - Subscription data
 * @returns Grace period end date or null if not applicable
 */
export function getSubscriptionGracePeriodEnd(
  subscription: Subscription
): Date | null {
  const now = new Date();

  // Check if cancelled
  if (subscription.status === "cancelled" || subscription.canceledAt) {
    const isInTrial =
      subscription.status === "trialing" &&
      subscription.trialEnd &&
      subscription.trialEnd > now;

    if (isInTrial) {
      return calculateTrialCancellationGracePeriod(
        subscription,
        subscription.canceledAt || new Date()
      );
    } else {
      return calculatePaidCancellationGracePeriod(
        subscription,
        subscription.canceledAt || new Date()
      );
    }
  }

  // Check if past due
  if (subscription.status === "past_due") {
    return calculatePastDueGracePeriod(subscription);
  }

  // Check if trial ended
  if (
    subscription.status === "trialing" &&
    subscription.trialEnd &&
    subscription.trialEnd < now
  ) {
    return calculateGracePeriodEnd("trial", subscription.trialEnd);
  }

  // No grace period applicable
  return null;
}
