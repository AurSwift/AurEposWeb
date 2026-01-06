import type { Subscription } from "@/lib/db/schema";

/**
 * Normalized subscription status types
 * Provides consistent status handling across the application
 */
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "cancelled"
  | "past_due"
  | "paused"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid";

/**
 * Normalize subscription status
 * Converts various status values to canonical format
 *
 * @param status - Raw status from database or Stripe
 * @returns Normalized status
 *
 * @example
 * const status = normalizeSubscriptionStatus("trialing");
 * // Returns: "active" (trialing is considered active)
 */
export function normalizeSubscriptionStatus(
  status: string | null | undefined
): SubscriptionStatus {
  if (!status) return "cancelled";

  const normalized = status.toLowerCase();

  // Trialing subscriptions are considered active
  if (normalized === "trialing") {
    return "active";
  }

  return normalized as SubscriptionStatus;
}

/**
 * Check if subscription is in active state
 * Includes both "active" and "trialing" statuses
 *
 * @param status - Subscription status
 * @returns True if subscription is active or trialing
 *
 * @example
 * if (isSubscriptionActive(subscription.status)) {
 *   // User has active access
 * }
 */
export function isSubscriptionActive(
  status: string | null | undefined
): boolean {
  if (!status) return false;

  const normalized = normalizeSubscriptionStatus(status);
  return normalized === "active" || normalized === "trialing";
}

/**
 * Check if subscription is in trial period
 *
 * @param subscription - Subscription object
 * @returns True if currently in trial period
 */
export function isInTrialPeriod(subscription: Subscription): boolean {
  if (subscription.status !== "trialing") return false;

  const now = new Date();
  return subscription.trialEnd ? subscription.trialEnd > now : false;
}

/**
 * Check if trial has ended
 *
 * @param subscription - Subscription object
 * @returns True if trial has ended
 */
export function hasTrialEnded(subscription: Subscription): boolean {
  if (!subscription.trialEnd) return false;

  const now = new Date();
  return subscription.trialEnd <= now;
}

/**
 * Calculate days until trial ends
 *
 * @param subscription - Subscription object
 * @returns Number of days until trial ends, or null if not in trial
 */
export function getDaysUntilTrialEnd(
  subscription: Subscription
): number | null {
  if (!subscription.trialEnd) return null;

  const now = new Date();
  const diff = subscription.trialEnd.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  return days > 0 ? days : 0;
}

/**
 * Check if subscription is cancelled but still active
 * (cancel_at_period_end = true)
 *
 * @param subscription - Subscription object
 * @returns True if cancelled but access remains until period end
 */
export function isCancelledButActive(subscription: Subscription): boolean {
  return (
    subscription.cancelAtPeriodEnd === true &&
    isSubscriptionActive(subscription.status)
  );
}

/**
 * Check if subscription requires payment
 *
 * @param status - Subscription status
 * @returns True if payment is required
 */
export function requiresPayment(status: string | null | undefined): boolean {
  if (!status) return false;

  const normalized = status.toLowerCase();
  return (
    normalized === "past_due" ||
    normalized === "incomplete" ||
    normalized === "unpaid"
  );
}

/**
 * Get days until subscription ends
 *
 * @param subscription - Subscription object
 * @returns Number of days until subscription ends, or null if not applicable
 */
export function getDaysUntilSubscriptionEnd(
  subscription: Subscription
): number | null {
  // Check if in trial
  if (isInTrialPeriod(subscription) && subscription.trialEnd) {
    return getDaysUntilTrialEnd(subscription);
  }

  // Check if cancelled and has period end
  if (subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd) {
    const now = new Date();
    const diff = subscription.currentPeriodEnd.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  }

  // No end date applicable
  return null;
}

/**
 * Get subscription end date
 *
 * @param subscription - Subscription object
 * @returns Date when subscription ends, or null if not applicable
 */
export function getSubscriptionEndDate(
  subscription: Subscription
): Date | null {
  // Check if in trial
  if (isInTrialPeriod(subscription) && subscription.trialEnd) {
    return subscription.trialEnd;
  }

  // Check if cancelled
  if (subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd) {
    return subscription.currentPeriodEnd;
  }

  // Check if already cancelled
  if (subscription.status === "cancelled" && subscription.canceledAt) {
    return subscription.canceledAt;
  }

  return null;
}

/**
 * Get human-readable subscription status
 *
 * @param subscription - Subscription object
 * @returns Human-readable status string
 */
export function getSubscriptionStatusDisplay(
  subscription: Subscription
): string {
  if (isCancelledButActive(subscription)) {
    const endDate = subscription.currentPeriodEnd;
    return `Active until ${endDate?.toLocaleDateString() || "period end"}`;
  }

  if (isInTrialPeriod(subscription)) {
    const days = getDaysUntilTrialEnd(subscription);
    if (days !== null) {
      return `Trial (${days} ${days === 1 ? "day" : "days"} remaining)`;
    }
    return "Trial";
  }

  const statusMap: Record<string, string> = {
    active: "Active",
    cancelled: "Cancelled",
    past_due: "Past Due - Payment Required",
    paused: "Paused",
    incomplete: "Incomplete - Payment Required",
    incomplete_expired: "Expired",
    unpaid: "Unpaid",
  };

  const status = subscription.status?.toLowerCase() || "unknown";
  return statusMap[status] || "Unknown";
}

/**
 * Check if subscription can be reactivated
 *
 * @param subscription - Subscription object
 * @returns True if subscription can be reactivated
 */
export function canReactivate(subscription: Subscription): boolean {
  // Can reactivate if cancelled but period hasn't ended
  return (
    subscription.cancelAtPeriodEnd === true &&
    subscription.status !== "cancelled"
  );
}
