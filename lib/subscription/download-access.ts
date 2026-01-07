/**
 * Download Access Control
 * Determines if a user has permission to download software based on subscription status
 */

export interface DownloadAccessResult {
  canDownload: boolean;
  reason?: string;
  requiresUpgrade: boolean;
}

/**
 * Check if user can download software based on subscription status
 * 
 * @param subscriptionStatus - Current subscription status (active, trialing, cancelled, etc.)
 * @returns DownloadAccessResult with permission details
 */
export function checkDownloadAccess(
  subscriptionStatus?: string | null
): DownloadAccessResult {
  // Allow download if subscription is active or trialing
  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    return {
      canDownload: true,
      requiresUpgrade: false,
    };
  }

  // User has no active subscription
  if (!subscriptionStatus) {
    return {
      canDownload: false,
      reason: "No active subscription. Please subscribe to download the software.",
      requiresUpgrade: true,
    };
  }

  // Subscription exists but is not active (cancelled, past_due, etc.)
  if (subscriptionStatus === "cancelled") {
    return {
      canDownload: false,
      reason: "Your subscription has been cancelled. Please reactivate to download.",
      requiresUpgrade: true,
    };
  }

  if (subscriptionStatus === "past_due") {
    return {
      canDownload: false,
      reason: "Your subscription payment is past due. Please update payment method.",
      requiresUpgrade: true,
    };
  }

  // Any other status
  return {
    canDownload: false,
    reason: "An active subscription is required to download the software.",
    requiresUpgrade: true,
  };
}

/**
 * Get user-friendly message for download access
 */
export function getDownloadAccessMessage(result: DownloadAccessResult): string {
  if (result.canDownload) {
    return "Download the latest version of AurSwift EPOS software";
  }
  return result.reason || "Download not available";
}

