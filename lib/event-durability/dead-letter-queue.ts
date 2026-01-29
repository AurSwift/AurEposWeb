/**
 * Dead Letter Queue Management (Phase 4: Event Durability & Reliability)
 *
 * Utilities for managing failed events that couldn't be processed
 * after maximum retry attempts.
 */

import { db } from "@/lib/db";
import {
  deadLetterQueue,
  subscriptionEvents,
  eventRetryHistory,
  eventAcknowledgments,
} from "@/lib/db/schema";
import { eq, and, lt, sql, desc } from "drizzle-orm";

// Configuration
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_BACKOFF_BASE_MS = 1000; // 1 second
const RETRY_BACKOFF_MULTIPLIER = 2; // Exponential backoff

/**
 * Calculate next retry delay using exponential backoff
 * Attempt 1: 1s, 2: 2s, 3: 4s, 4: 8s, 5: 16s
 */
export function calculateBackoff(attemptNumber: number): number {
  return (
    RETRY_BACKOFF_BASE_MS *
    Math.pow(RETRY_BACKOFF_MULTIPLIER, attemptNumber - 1)
  );
}

/**
 * Move an event to the dead letter queue
 * Called when an event fails after max retry attempts
 */
export async function moveToDeadLetterQueue(params: {
  eventId: string;
  licenseKey: string;
  eventType: string;
  payload: Record<string, unknown>;
  originalCreatedAt: Date;
  retryCount: number;
  lastErrorMessage?: string;
}): Promise<void> {
  try {
    console.log(
      `[DLQ] Moving event ${params.eventId} to dead letter queue after ${params.retryCount} failed attempts`
    );

    // Check if already in DLQ
    const existing = await db
      .select()
      .from(deadLetterQueue)
      .where(eq(deadLetterQueue.eventId, params.eventId))
      .limit(1);

    if (existing.length > 0) {
      console.log(`[DLQ] Event ${params.eventId} already in dead letter queue`);
      // Update existing entry
      await db
        .update(deadLetterQueue)
        .set({
          retryCount: params.retryCount,
          lastErrorMessage: params.lastErrorMessage,
          lastErrorAt: new Date(),
        })
        .where(eq(deadLetterQueue.eventId, params.eventId));
      return;
    }

    // Insert into DLQ
    await db.insert(deadLetterQueue).values({
      eventId: params.eventId,
      licenseKey: params.licenseKey,
      eventType: params.eventType,
      payload: params.payload,
      originalCreatedAt: params.originalCreatedAt,
      retryCount: params.retryCount,
      lastErrorMessage: params.lastErrorMessage || null,
      lastErrorAt: params.lastErrorMessage ? new Date() : null,
      status: "pending_review",
    });

    console.log(`[DLQ] ✅ Event ${params.eventId} moved to dead letter queue`);
  } catch (error) {
    console.error("[DLQ] Failed to move event to dead letter queue:", error);
    throw error;
  }
}

/**
 * Record a retry attempt in history
 */
export async function recordRetryAttempt(params: {
  eventId: string;
  attemptNumber: number;
  result: "success" | "failed" | "timeout";
  errorMessage?: string;
  nextRetryAt?: Date;
}): Promise<void> {
  try {
    const backoffDelayMs = params.nextRetryAt
      ? params.nextRetryAt.getTime() - Date.now()
      : null;

    await db.insert(eventRetryHistory).values({
      eventId: params.eventId,
      attemptNumber: params.attemptNumber,
      result: params.result,
      errorMessage: params.errorMessage || null,
      nextRetryAt: params.nextRetryAt || null,
      backoffDelayMs,
    });

    console.log(
      `[Retry History] Recorded attempt ${params.attemptNumber} for ${params.eventId}: ${params.result}`
    );
  } catch (error) {
    console.error("[Retry History] Failed to record retry attempt:", error);
  }
}

/**
 * Get events that need retry
 * Returns events that:
 * 1. Don't have successful acknowledgment
 * 2. Haven't exceeded max retries
 * 3. Are past their next retry time
 */
export async function getEventsNeedingRetry(): Promise<
  Array<{
    eventId: string;
    licenseKey: string;
    eventType: string;
    payload: Record<string, unknown>;
    createdAt: Date;
    retryCount: number;
    lastRetryAt?: Date;
  }>
> {
  try {
    // Get all events from last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const events = await db
      .select()
      .from(subscriptionEvents)
      .where(
        and(
          lt(subscriptionEvents.createdAt, twentyFourHoursAgo),
          lt(subscriptionEvents.expiresAt, new Date())
        )
      );

    const eventsNeedingRetry = [];

    for (const event of events) {
      // Check if event has successful acknowledgment
      const acks = await db
        .select()
        .from(eventAcknowledgments)
        .where(
          and(
            eq(eventAcknowledgments.eventId, event.eventId),
            eq(eventAcknowledgments.status, "success")
          )
        )
        .limit(1);

      if (acks.length > 0) {
        continue; // Event successfully processed
      }

      // Get retry history
      const retryHistory = await db
        .select()
        .from(eventRetryHistory)
        .where(eq(eventRetryHistory.eventId, event.eventId))
        .orderBy(desc(eventRetryHistory.attemptNumber));

      const retryCount = retryHistory.length;

      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        // Move to DLQ
        await moveToDeadLetterQueue({
          eventId: event.eventId,
          licenseKey: event.licenseKey,
          eventType: event.eventType,
          payload: event.payload as Record<string, unknown>,
          originalCreatedAt: event.createdAt,
          retryCount,
          lastErrorMessage:
            retryHistory[0]?.errorMessage || "Max retries exceeded",
        });
        continue;
      }

      // Check if enough time has passed for next retry
      const lastRetry = retryHistory[0];
      if (lastRetry?.nextRetryAt && lastRetry.nextRetryAt > new Date()) {
        continue; // Not time for next retry yet
      }

      eventsNeedingRetry.push({
        eventId: event.eventId,
        licenseKey: event.licenseKey,
        eventType: event.eventType,
        payload: event.payload as Record<string, unknown>,
        createdAt: event.createdAt,
        retryCount,
        lastRetryAt: lastRetry?.attemptedAt,
      });
    }

    return eventsNeedingRetry;
  } catch (error) {
    console.error("[DLQ] Failed to get events needing retry:", error);
    return [];
  }
}

/**
 * Get dead letter queue statistics
 */
export async function getDLQStats(): Promise<{
  total: number;
  pendingReview: number;
  retrying: number;
  resolved: number;
  abandoned: number;
  oldestItem: Date | null;
  newestItem: Date | null;
}> {
  try {
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(deadLetterQueue);

    const pendingResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(deadLetterQueue)
      .where(eq(deadLetterQueue.status, "pending_review"));

    const retryingResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(deadLetterQueue)
      .where(eq(deadLetterQueue.status, "retrying"));

    const resolvedResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(deadLetterQueue)
      .where(eq(deadLetterQueue.status, "resolved"));

    const abandonedResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(deadLetterQueue)
      .where(eq(deadLetterQueue.status, "abandoned"));

    const oldestResult = await db
      .select({ failedAt: deadLetterQueue.failedAt })
      .from(deadLetterQueue)
      .orderBy(deadLetterQueue.failedAt)
      .limit(1);

    const newestResult = await db
      .select({ failedAt: deadLetterQueue.failedAt })
      .from(deadLetterQueue)
      .orderBy(desc(deadLetterQueue.failedAt))
      .limit(1);

    return {
      total: totalResult[0]?.count || 0,
      pendingReview: pendingResult[0]?.count || 0,
      retrying: retryingResult[0]?.count || 0,
      resolved: resolvedResult[0]?.count || 0,
      abandoned: abandonedResult[0]?.count || 0,
      oldestItem: oldestResult[0]?.failedAt || null,
      newestItem: newestResult[0]?.failedAt || null,
    };
  } catch (error) {
    console.error("[DLQ] Failed to get DLQ stats:", error);
    throw error;
  }
}

/**
 * Retry a single event from DLQ manually
 */
export async function retryDLQEvent(eventId: string): Promise<boolean> {
  try {
    const item = await db
      .select()
      .from(deadLetterQueue)
      .where(eq(deadLetterQueue.eventId, eventId))
      .limit(1);

    if (item.length === 0) {
      console.warn(`[DLQ] Event ${eventId} not found in DLQ`);
      return false;
    }

    // Update status to retrying
    await db
      .update(deadLetterQueue)
      .set({ status: "retrying" })
      .where(eq(deadLetterQueue.eventId, eventId));

    // Re-insert into subscription_events for retry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour retry window

    await db.insert(subscriptionEvents).values({
      eventId: item[0].eventId,
      licenseKey: item[0].licenseKey,
      eventType: item[0].eventType,
      payload: item[0].payload,
      createdAt: new Date(),
      expiresAt,
    });

    console.log(`[DLQ] ✅ Event ${eventId} re-queued for retry`);
    return true;
  } catch (error) {
    console.error(`[DLQ] Failed to retry event ${eventId}:`, error);
    return false;
  }
}

/**
 * Mark DLQ item as resolved
 */
export async function resolveDLQEvent(
  eventId: string,
  resolvedBy: string,
  notes?: string
): Promise<boolean> {
  try {
    await db
      .update(deadLetterQueue)
      .set({
        status: "resolved",
        resolvedBy,
        resolvedAt: new Date(),
        resolutionNotes: notes || null,
      })
      .where(eq(deadLetterQueue.eventId, eventId));

    console.log(`[DLQ] ✅ Event ${eventId} marked as resolved`);
    return true;
  } catch (error) {
    console.error(`[DLQ] Failed to resolve event ${eventId}:`, error);
    return false;
  }
}

/**
 * Mark DLQ item as abandoned
 */
export async function abandonDLQEvent(
  eventId: string,
  resolvedBy: string,
  notes?: string
): Promise<boolean> {
  try {
    await db
      .update(deadLetterQueue)
      .set({
        status: "abandoned",
        resolvedBy,
        resolvedAt: new Date(),
        resolutionNotes: notes || null,
      })
      .where(eq(deadLetterQueue.eventId, eventId));

    console.log(`[DLQ] Event ${eventId} marked as abandoned`);
    return true;
  } catch (error) {
    console.error(`[DLQ] Failed to abandon event ${eventId}:`, error);
    return false;
  }
}
