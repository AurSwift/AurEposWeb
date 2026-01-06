import { db } from "@/lib/db";
import { subscriptions, licenseKeys, customers, users } from "@/lib/db/schema";
import { eq, and, lte, or, sql, isNotNull } from "drizzle-orm";
import {
  sendTrialEnding3DaysEmail,
  sendTrialEnding1DayEmail,
  sendTrialEndedEmail,
  sendGracePeriodEndingEmail,
  sendLicenseDeactivatedEmail,
} from "@/lib/emails/trial-notifications";
import {
  publishSubscriptionCancelled,
  getLicenseKeysForSubscription,
} from "@/lib/subscription-events";

/**
 * Trial and Subscription Expiration Cron Jobs
 *
 * This module contains automated jobs that should run on a schedule:
 * - Trial ending notifications (3 days, 1 day before)
 * - Trial expiration handling
 * - Grace period expiration handling
 * - License deactivation
 *
 * DEPLOYMENT NOTE:
 * These functions should be called by a cron job service such as:
 * - Vercel Cron Jobs (vercel.json)
 * - AWS Lambda with CloudWatch Events
 * - Node-cron for self-hosted
 * - GitHub Actions scheduled workflows
 *
 * Recommended Schedule:
 * - checkTrialExpirations: Every 6 hours (cron: 0 star-slash-6 star star star)
 * - checkGracePeriodExpirations: Every 12 hours (cron: 0 star-slash-12 star star star)
 */

interface NotificationResult {
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
}

interface ExpirationResult {
  processed: number;
  deactivated: number;
  errors: string[];
}

/**
 * Check for trials ending soon and send notifications
 * Should run every 6 hours
 */
export async function checkTrialExpirations(): Promise<{
  ending3Days: NotificationResult;
  ending1Day: NotificationResult;
  expired: ExpirationResult;
}> {
  console.log("[CRON] Starting trial expiration check...");

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

  // Results tracking
  const ending3DaysResult: NotificationResult = {
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };
  const ending1DayResult: NotificationResult = {
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };
  const expiredResult: ExpirationResult = {
    processed: 0,
    deactivated: 0,
    errors: [],
  };

  try {
    // ========================================================================
    // 1. Find trials ending in 3 days (within 3-4 days window)
    // ========================================================================
    const threeDayWindow = new Date(
      threeDaysFromNow.getTime() + 24 * 60 * 60 * 1000
    );

    const trialsEnding3Days = await db
      .select({
        subscription: subscriptions,
        customer: customers,
        user: users,
      })
      .from(subscriptions)
      .innerJoin(customers, eq(subscriptions.customerId, customers.id))
      .innerJoin(users, eq(customers.userId, users.id))
      .where(
        and(
          eq(subscriptions.status, "trialing"),
          isNotNull(subscriptions.trialEnd),
          lte(subscriptions.trialEnd, threeDayWindow),
          sql`${subscriptions.trialEnd} > ${threeDaysFromNow}`,
          // Only notify if not cancelled
          or(
            eq(subscriptions.cancelAtPeriodEnd, false),
            sql`${subscriptions.cancelAtPeriodEnd} IS NULL`
          )
        )
      );

    console.log(
      `[CRON] Found ${trialsEnding3Days.length} trials ending in 3 days`
    );

    for (const { subscription, user } of trialsEnding3Days) {
      if (!user.email || !subscription.trialEnd) {
        ending3DaysResult.skipped++;
        continue;
      }

      try {
        const result = await sendTrialEnding3DaysEmail({
          email: user.email,
          userName: user.name || undefined,
          planName: subscription.planType || "Basic Plan",
          trialEndDate: subscription.trialEnd,
          loginUrl: `${process.env.NEXTAUTH_URL}/dashboard`,
          billingUrl: `${process.env.NEXTAUTH_URL}/dashboard/billing`,
        });

        if (result.success) {
          ending3DaysResult.sent++;
        } else {
          ending3DaysResult.failed++;
          ending3DaysResult.errors.push(
            `Failed to notify ${user.email}: ${result.error}`
          );
        }
      } catch (error) {
        ending3DaysResult.failed++;
        ending3DaysResult.errors.push(
          `Exception notifying ${user.email}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    // ========================================================================
    // 2. Find trials ending in 1 day (within 1-2 days window)
    // ========================================================================
    const oneDayWindow = new Date(
      oneDayFromNow.getTime() + 24 * 60 * 60 * 1000
    );

    const trialsEnding1Day = await db
      .select({
        subscription: subscriptions,
        customer: customers,
        user: users,
      })
      .from(subscriptions)
      .innerJoin(customers, eq(subscriptions.customerId, customers.id))
      .innerJoin(users, eq(customers.userId, users.id))
      .where(
        and(
          eq(subscriptions.status, "trialing"),
          isNotNull(subscriptions.trialEnd),
          lte(subscriptions.trialEnd, oneDayWindow),
          sql`${subscriptions.trialEnd} > ${oneDayFromNow}`,
          or(
            eq(subscriptions.cancelAtPeriodEnd, false),
            sql`${subscriptions.cancelAtPeriodEnd} IS NULL`
          )
        )
      );

    console.log(
      `[CRON] Found ${trialsEnding1Day.length} trials ending in 1 day`
    );

    for (const { subscription, user } of trialsEnding1Day) {
      if (!user.email || !subscription.trialEnd) {
        ending1DayResult.skipped++;
        continue;
      }

      try {
        const result = await sendTrialEnding1DayEmail({
          email: user.email,
          userName: user.name || undefined,
          planName: subscription.planType || "Basic Plan",
          trialEndDate: subscription.trialEnd,
          billingUrl: `${process.env.NEXTAUTH_URL}/dashboard/billing`,
        });

        if (result.success) {
          ending1DayResult.sent++;
        } else {
          ending1DayResult.failed++;
          ending1DayResult.errors.push(
            `Failed to notify ${user.email}: ${result.error}`
          );
        }
      } catch (error) {
        ending1DayResult.failed++;
        ending1DayResult.errors.push(
          `Exception notifying ${user.email}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    // ========================================================================
    // 3. Find expired trials (trial ended, no active subscription)
    // ========================================================================
    const expiredTrials = await db
      .select({
        subscription: subscriptions,
        customer: customers,
        user: users,
      })
      .from(subscriptions)
      .innerJoin(customers, eq(subscriptions.customerId, customers.id))
      .innerJoin(users, eq(customers.userId, users.id))
      .where(
        and(
          // Trial ended
          isNotNull(subscriptions.trialEnd),
          lte(subscriptions.trialEnd, now),
          // Still marked as trialing (Stripe webhook may not have fired)
          or(
            eq(subscriptions.status, "trialing"),
            eq(subscriptions.status, "incomplete")
          )
        )
      );

    console.log(`[CRON] Found ${expiredTrials.length} expired trials`);

    for (const { subscription, user } of expiredTrials) {
      expiredResult.processed++;

      try {
        // Calculate grace period (7 days after trial end)
        const gracePeriodEnd = new Date(
          subscription.trialEnd!.getTime() + 7 * 24 * 60 * 60 * 1000
        );

        if (now > gracePeriodEnd) {
          // Grace period expired - deactivate licenses
          await db.transaction(async (tx) => {
            // Update subscription status
            await tx
              .update(subscriptions)
              .set({
                status: "cancelled",
                canceledAt: subscription.canceledAt || now,
                updatedAt: now,
              })
              .where(eq(subscriptions.id, subscription.id));

            // Revoke all license keys
            await tx
              .update(licenseKeys)
              .set({
                isActive: false,
                revokedAt: now,
                revocationReason: "Trial expired - no payment method",
              })
              .where(eq(licenseKeys.subscriptionId, subscription.id));
          });

          expiredResult.deactivated++;

          // Send license deactivated notification
          if (user.email) {
            sendLicenseDeactivatedEmail({
              email: user.email,
              userName: user.name || undefined,
              planName: subscription.planType || "Basic Plan",
              reactivateUrl: `${process.env.NEXTAUTH_URL}/dashboard/billing`,
            }).catch((error) => {
              console.error(
                `Failed to send deactivation email to ${user.email}:`,
                error
              );
            });
          }

          // Notify desktop via SSE
          const licenseKeysList = await getLicenseKeysForSubscription(
            subscription.id
          );
          for (const key of licenseKeysList) {
            publishSubscriptionCancelled(key, {
              cancelledAt: now,
              cancelImmediately: true,
              gracePeriodEnd: now,
              reason: "Trial expired - no payment method",
            });
          }

          console.log(
            `[CRON] Deactivated licenses for expired trial: ${subscription.id}`
          );
        } else {
          // Still in grace period - send trial ended notification
          if (user.email && subscription.trialEnd) {
            sendTrialEndedEmail({
              email: user.email,
              userName: user.name || undefined,
              planName: subscription.planType || "Basic Plan",
              trialEndDate: subscription.trialEnd,
              billingUrl: `${process.env.NEXTAUTH_URL}/dashboard/billing`,
            }).catch((error) => {
              console.error(
                `Failed to send trial ended email to ${user.email}:`,
                error
              );
            });
          }

          console.log(
            `[CRON] Trial expired but in grace period: ${
              subscription.id
            } (until ${gracePeriodEnd.toISOString()})`
          );
        }
      } catch (error) {
        expiredResult.errors.push(
          `Failed to process expired trial ${subscription.id}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }
  } catch (error) {
    console.error("[CRON] Trial expiration check failed:", error);
    throw error;
  }

  const summary = {
    ending3Days: ending3DaysResult,
    ending1Day: ending1DayResult,
    expired: expiredResult,
  };

  console.log("[CRON] Trial expiration check completed:", summary);
  return summary;
}

/**
 * Check for grace periods expiring soon and send warnings
 * Should run every 12 hours
 */
export async function checkGracePeriodExpirations(): Promise<{
  ending3Days: NotificationResult;
  ending1Day: NotificationResult;
  expired: ExpirationResult;
}> {
  console.log("[CRON] Starting grace period expiration check...");

  const now = new Date();
  const GRACE_PERIOD_DAYS = 7;

  const ending3DaysResult: NotificationResult = {
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };
  const ending1DayResult: NotificationResult = {
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };
  const expiredResult: ExpirationResult = {
    processed: 0,
    deactivated: 0,
    errors: [],
  };

  try {
    // Find all cancelled subscriptions still in grace period
    const cancelledSubscriptions = await db
      .select({
        subscription: subscriptions,
        customer: customers,
        user: users,
      })
      .from(subscriptions)
      .innerJoin(customers, eq(subscriptions.customerId, customers.id))
      .innerJoin(users, eq(customers.userId, users.id))
      .where(
        and(
          eq(subscriptions.status, "cancelled"),
          isNotNull(subscriptions.canceledAt)
        )
      );

    console.log(
      `[CRON] Found ${cancelledSubscriptions.length} cancelled subscriptions`
    );

    for (const { subscription, user } of cancelledSubscriptions) {
      if (!subscription.canceledAt) continue;

      const gracePeriodEnd = new Date(
        subscription.canceledAt.getTime() +
          GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
      );

      const daysUntilExpiration = Math.ceil(
        (gracePeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );

      // Check if license keys are already revoked
      const activeLicenses = await db
        .select()
        .from(licenseKeys)
        .where(
          and(
            eq(licenseKeys.subscriptionId, subscription.id),
            eq(licenseKeys.isActive, true)
          )
        );

      if (activeLicenses.length === 0) {
        // Already deactivated, skip
        continue;
      }

      // Grace period expired - deactivate now
      if (now >= gracePeriodEnd) {
        expiredResult.processed++;

        try {
          await db
            .update(licenseKeys)
            .set({
              isActive: false,
              revokedAt: now,
              revocationReason: "Grace period expired",
            })
            .where(eq(licenseKeys.subscriptionId, subscription.id));

          expiredResult.deactivated++;

          // Send deactivation notification
          if (user.email) {
            sendLicenseDeactivatedEmail({
              email: user.email,
              userName: user.name || undefined,
              planName: subscription.planType || "Basic Plan",
              reactivateUrl: `${process.env.NEXTAUTH_URL}/dashboard/billing`,
            }).catch((error) => {
              console.error(
                `Failed to send deactivation email to ${user.email}:`,
                error
              );
            });
          }

          // Notify desktop via SSE
          const licenseKeysList = await getLicenseKeysForSubscription(
            subscription.id
          );
          for (const key of licenseKeysList) {
            publishSubscriptionCancelled(key, {
              cancelledAt: subscription.canceledAt!,
              cancelImmediately: true,
              gracePeriodEnd: now,
              reason: "Grace period expired",
            });
          }

          console.log(
            `[CRON] Deactivated licenses for subscription ${subscription.id} (grace period expired)`
          );
        } catch (error) {
          expiredResult.errors.push(
            `Failed to deactivate subscription ${subscription.id}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }
      // 3 days until expiration
      else if (daysUntilExpiration === 3) {
        if (user.email) {
          try {
            const result = await sendGracePeriodEndingEmail({
              email: user.email,
              userName: user.name || undefined,
              planName: subscription.planType || "Basic Plan",
              gracePeriodEndDate: gracePeriodEnd,
              daysRemaining: 3,
              reactivateUrl: `${process.env.NEXTAUTH_URL}/dashboard/billing`,
            });

            if (result.success) {
              ending3DaysResult.sent++;
            } else {
              ending3DaysResult.failed++;
              ending3DaysResult.errors.push(
                `Failed to notify ${user.email}: ${result.error}`
              );
            }
          } catch (error) {
            ending3DaysResult.failed++;
            ending3DaysResult.errors.push(
              `Exception notifying ${user.email}: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
          }
        } else {
          ending3DaysResult.skipped++;
        }
      }
      // 1 day until expiration
      else if (daysUntilExpiration === 1) {
        if (user.email) {
          try {
            const result = await sendGracePeriodEndingEmail({
              email: user.email,
              userName: user.name || undefined,
              planName: subscription.planType || "Basic Plan",
              gracePeriodEndDate: gracePeriodEnd,
              daysRemaining: 1,
              reactivateUrl: `${process.env.NEXTAUTH_URL}/dashboard/billing`,
            });

            if (result.success) {
              ending1DayResult.sent++;
            } else {
              ending1DayResult.failed++;
              ending1DayResult.errors.push(
                `Failed to notify ${user.email}: ${result.error}`
              );
            }
          } catch (error) {
            ending1DayResult.failed++;
            ending1DayResult.errors.push(
              `Exception notifying ${user.email}: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
          }
        } else {
          ending1DayResult.skipped++;
        }
      }
    }
  } catch (error) {
    console.error("[CRON] Grace period expiration check failed:", error);
    throw error;
  }

  const summary = {
    ending3Days: ending3DaysResult,
    ending1Day: ending1DayResult,
    expired: expiredResult,
  };

  console.log("[CRON] Grace period expiration check completed:", summary);
  return summary;
}

/**
 * Combined cron job - runs all checks
 * Recommended for single cron endpoint
 */
export async function runAllExpirationChecks() {
  console.log("[CRON] Starting all expiration checks...");

  const trialResults = await checkTrialExpirations();
  const gracePeriodResults = await checkGracePeriodExpirations();

  const summary = {
    timestamp: new Date().toISOString(),
    trials: trialResults,
    gracePeriods: gracePeriodResults,
    totalNotificationsSent:
      trialResults.ending3Days.sent +
      trialResults.ending1Day.sent +
      gracePeriodResults.ending3Days.sent +
      gracePeriodResults.ending1Day.sent,
    totalDeactivations:
      trialResults.expired.deactivated + gracePeriodResults.expired.deactivated,
  };

  console.log("[CRON] All expiration checks completed:", summary);
  return summary;
}
