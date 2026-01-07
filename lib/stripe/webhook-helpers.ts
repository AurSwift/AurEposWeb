import { db } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Determines if an error should trigger a webhook retry from Stripe
 * @param error - The error object
 * @returns true if Stripe should retry, false otherwise
 */
export function shouldRetryError(error: unknown): boolean {
  // Network/connection errors - should retry
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Database connection errors
    if (
      message.includes("connection") ||
      message.includes("timeout") ||
      message.includes("econnrefused") ||
      message.includes("enotfound")
    ) {
      return true;
    }

    // Temporary database issues
    if (
      message.includes("lock") ||
      message.includes("deadlock") ||
      message.includes("too many connections")
    ) {
      return true;
    }

    // Rate limiting
    if (message.includes("rate limit") || message.includes("429")) {
      return true;
    }
  }

  // Business logic errors - don't retry
  // Missing data, validation errors, etc. won't fix themselves
  return false;
}

/**
 * Logs webhook processing errors to the webhookEvents table
 * @param eventId - Stripe event ID
 * @param error - The error that occurred
 * @param retryable - Whether the error is retryable
 */
export async function logWebhookError(
  eventId: string,
  error: unknown,
  retryable: boolean
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  try {
    await db
      .update(webhookEvents)
      .set({
        processed: false,
        metadata: sql`${webhookEvents.metadata} || jsonb_build_object(
          'error', ${errorMessage},
          'errorStack', ${errorStack || null},
          'retryable', ${retryable},
          'failedAt', ${new Date().toISOString()}
        )`,
      })
      .where(eq(webhookEvents.stripeEventId, eventId));
  } catch (logError) {
    // Logging the error failed - just console log
    console.error("Failed to log webhook error to database:", logError);
  }
}

/**
 * Logs successful webhook processing
 * @param eventId - Stripe event ID
 */
export async function markWebhookSuccess(eventId: string): Promise<void> {
  try {
    await db
      .update(webhookEvents)
      .set({
        processed: true,
        metadata: sql`${webhookEvents.metadata} || jsonb_build_object(
          'processedAt', ${new Date().toISOString()}
        )`,
      })
      .where(eq(webhookEvents.stripeEventId, eventId));
  } catch (error) {
    // Non-critical - event was already processed successfully
    console.warn("Failed to mark webhook as processed:", error);
  }
}

/**
 * Wraps a function in a database transaction with automatic rollback on error
 * @param fn - Async function to execute within transaction
 * @returns Result of the function
 */
export async function withTransaction<T>(
  fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    return await fn(tx);
  });
}

/**
 * Get HTTP status code for webhook response based on error type
 * @param error - The error object
 * @returns HTTP status code (500 for retryable, 200 for non-retryable)
 */
export function getWebhookErrorStatus(error: unknown): number {
  const retryable = shouldRetryError(error);
  
  // Return 500 for retryable errors (Stripe will retry)
  // Return 200 for non-retryable errors (no point retrying)
  return retryable ? 500 : 200;
}
