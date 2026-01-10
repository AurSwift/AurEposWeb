/**
 * Event Retry Mechanism (Phase 4: Event Durability & Reliability)
 *
 * Background job that:
 * 1. Identifies events without successful acknowledgment
 * 2. Retries failed events with exponential backoff
 * 3. Moves events to DLQ after max retries
 *
 * Run this via cron job every 5 minutes
 */

import {
  getEventsNeedingRetry,
  recordRetryAttempt,
  calculateBackoff,
  moveToDeadLetterQueue,
} from "./dead-letter-queue";
import { publishEvent } from "@/lib/subscription-events/redis-publisher";
import { createSubscriptionEvent } from "@/lib/subscription-events/types";

const MAX_RETRY_ATTEMPTS = 5;

/**
 * Process all events that need retry
 * Returns statistics about the retry operation
 */
export async function processEventRetries(): Promise<{
  checked: number;
  retried: number;
  movedToDLQ: number;
  failed: number;
}> {
  const stats = {
    checked: 0,
    retried: 0,
    movedToDLQ: 0,
    failed: 0,
  };

  try {
    console.log("[Retry Mechanism] Starting event retry process...");

    const eventsNeedingRetry = await getEventsNeedingRetry();
    stats.checked = eventsNeedingRetry.length;

    console.log(
      `[Retry Mechanism] Found ${eventsNeedingRetry.length} events needing retry`
    );

    for (const event of eventsNeedingRetry) {
      try {
        const nextAttemptNumber = event.retryCount + 1;

        // Check if exceeded max retries
        if (nextAttemptNumber > MAX_RETRY_ATTEMPTS) {
          console.log(
            `[Retry Mechanism] Event ${event.eventId} exceeded max retries, moving to DLQ`
          );

          await moveToDeadLetterQueue({
            eventId: event.eventId,
            licenseKey: event.licenseKey,
            eventType: event.eventType,
            payload: event.payload,
            originalCreatedAt: event.createdAt,
            retryCount: event.retryCount,
            lastErrorMessage: "Maximum retry attempts exceeded",
          });

          stats.movedToDLQ++;
          continue;
        }

        // Calculate backoff delay
        const backoffMs = calculateBackoff(nextAttemptNumber);
        const nextRetryAt = new Date(Date.now() + backoffMs);

        console.log(
          `[Retry Mechanism] Retrying event ${event.eventId} (attempt ${nextAttemptNumber}/${MAX_RETRY_ATTEMPTS})`
        );

        // Republish the event
        try {
          const subscriptionEvent = createSubscriptionEvent(
            event.eventType as
              | "subscription_cancelled"
              | "subscription_reactivated"
              | "subscription_updated"
              | "subscription_past_due"
              | "subscription_payment_succeeded"
              | "license_revoked"
              | "license_reactivated"
              | "plan_changed",
            event.licenseKey,
            event.payload as never // Type assertion needed - payload type depends on event type
          );

          // Use the original event ID for idempotency
          subscriptionEvent.id = event.eventId;

          await publishEvent(subscriptionEvent);

          // Record successful retry attempt
          await recordRetryAttempt({
            eventId: event.eventId,
            attemptNumber: nextAttemptNumber,
            result: "success",
            nextRetryAt,
          });

          stats.retried++;
          console.log(
            `[Retry Mechanism] ✅ Event ${
              event.eventId
            } republished (next retry: ${nextRetryAt.toISOString()})`
          );
        } catch (retryError) {
          // Record failed retry attempt
          await recordRetryAttempt({
            eventId: event.eventId,
            attemptNumber: nextAttemptNumber,
            result: "failed",
            errorMessage:
              retryError instanceof Error
                ? retryError.message
                : "Unknown error",
            nextRetryAt,
          });

          stats.failed++;
          console.error(
            `[Retry Mechanism] ❌ Failed to retry event ${event.eventId}:`,
            retryError
          );
        }
      } catch (error) {
        console.error(
          `[Retry Mechanism] Error processing event ${event.eventId}:`,
          error
        );
        stats.failed++;
      }
    }

    console.log("[Retry Mechanism] ✅ Retry process completed:", stats);
    return stats;
  } catch (error) {
    console.error("[Retry Mechanism] Fatal error in retry process:", error);
    throw error;
  }
}

/**
 * Get retry statistics for monitoring
 */
export async function getRetryStats(): Promise<{
  eventsAwaitingRetry: number;
  lastProcessedAt: Date | null;
}> {
  try {
    const eventsNeedingRetry = await getEventsNeedingRetry();

    return {
      eventsAwaitingRetry: eventsNeedingRetry.length,
      lastProcessedAt: new Date(), // Could be stored in a separate metadata table
    };
  } catch (error) {
    console.error("[Retry Mechanism] Failed to get retry stats:", error);
    return {
      eventsAwaitingRetry: 0,
      lastProcessedAt: null,
    };
  }
}
