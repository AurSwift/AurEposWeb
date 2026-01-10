/**
 * Event Cleanup Cron Job
 *
 * Deletes expired subscription events from the database.
 * Events have a 24-hour TTL set in expiresAt column.
 *
 * Run this via:
 * 1. Vercel Cron (add to vercel.json)
 * 2. External scheduler (cron-job.org, GitHub Actions)
 * 3. Manual trigger via API endpoint
 */

import { db } from "@/lib/db";
import { subscriptionEvents } from "@/lib/db/schema";
import { lt, sql } from "drizzle-orm";

/**
 * Delete subscription events older than their expiry time
 * @returns Number of deleted events
 */
export async function cleanupExpiredEvents(): Promise<number> {
  try {
    console.log("[Event Cleanup] Starting cleanup of expired events...");

    const now = new Date();

    // Delete events where expiresAt < now and get the deleted records
    const deletedRecords = await db
      .delete(subscriptionEvents)
      .where(lt(subscriptionEvents.expiresAt, now))
      .returning({ id: subscriptionEvents.id });

    const deletedCount = deletedRecords.length;

    console.log(`[Event Cleanup] ✅ Deleted ${deletedCount} expired events`);

    return deletedCount;
  } catch (error) {
    console.error("[Event Cleanup] ❌ Cleanup failed:", error);
    throw error;
  }
}

/**
 * Get cleanup statistics
 * @returns Statistics about current and expired events
 */
export async function getCleanupStats(): Promise<{
  total: number;
  expired: number;
  active: number;
  oldestEvent: Date | null;
  newestEvent: Date | null;
}> {
  try {
    const now = new Date();

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscriptionEvents);
    const total = totalResult[0]?.count || 0;

    // Get expired count
    const expiredResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscriptionEvents)
      .where(lt(subscriptionEvents.expiresAt, now));
    const expired = expiredResult[0]?.count || 0;

    // Get oldest and newest events
    const oldestResult = await db
      .select({ createdAt: subscriptionEvents.createdAt })
      .from(subscriptionEvents)
      .orderBy(subscriptionEvents.createdAt)
      .limit(1);

    const newestResult = await db
      .select({ createdAt: subscriptionEvents.createdAt })
      .from(subscriptionEvents)
      .orderBy(sql`${subscriptionEvents.createdAt} DESC`)
      .limit(1);

    return {
      total,
      expired,
      active: total - expired,
      oldestEvent: oldestResult[0]?.createdAt || null,
      newestEvent: newestResult[0]?.createdAt || null,
    };
  } catch (error) {
    console.error("[Event Cleanup] Failed to get stats:", error);
    throw error;
  }
}
