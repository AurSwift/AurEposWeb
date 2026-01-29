/**
 * Event Durability Monitoring API (Phase 4)
 *
 * GET /api/monitoring/event-durability
 *
 * Provides comprehensive statistics about event delivery,
 * acknowledgments, retries, and dead letter queue.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  subscriptionEvents,
  eventAcknowledgments,
  eventRetryHistory,
} from "@/lib/db/schema";
import { sql, gte, eq, and } from "drizzle-orm";
import { getDLQStats } from "@/lib/event-durability/dead-letter-queue";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hours = parseInt(searchParams.get("hours") || "24");

    const timeWindow = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Event Statistics
    const totalEventsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscriptionEvents)
      .where(gte(subscriptionEvents.createdAt, timeWindow));

    const totalEvents = totalEventsResult[0]?.count || 0;

    // Acknowledgment Statistics
    const totalAcksResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(eventAcknowledgments)
      .where(gte(eventAcknowledgments.acknowledgedAt, timeWindow));

    const successfulAcksResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(eventAcknowledgments)
      .where(
        and(
          gte(eventAcknowledgments.acknowledgedAt, timeWindow),
          eq(eventAcknowledgments.status, "success")
        )
      );

    const failedAcksResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(eventAcknowledgments)
      .where(
        and(
          gte(eventAcknowledgments.acknowledgedAt, timeWindow),
          eq(eventAcknowledgments.status, "failed")
        )
      );

    const totalAcks = totalAcksResult[0]?.count || 0;
    const successfulAcks = successfulAcksResult[0]?.count || 0;
    const failedAcks = failedAcksResult[0]?.count || 0;

    // Retry Statistics
    const totalRetriesResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(eventRetryHistory)
      .where(gte(eventRetryHistory.attemptedAt, timeWindow));

    const successfulRetriesResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(eventRetryHistory)
      .where(
        and(
          gte(eventRetryHistory.attemptedAt, timeWindow),
          eq(eventRetryHistory.result, "success")
        )
      );

    const failedRetriesResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(eventRetryHistory)
      .where(
        and(
          gte(eventRetryHistory.attemptedAt, timeWindow),
          eq(eventRetryHistory.result, "failed")
        )
      );

    const totalRetries = totalRetriesResult[0]?.count || 0;
    const successfulRetries = successfulRetriesResult[0]?.count || 0;
    const failedRetries = failedRetriesResult[0]?.count || 0;

    // DLQ Statistics
    const dlqStats = await getDLQStats();

    // Average processing time
    const avgProcessingTimeResult = await db
      .select({
        avg: sql<number>`AVG(${eventAcknowledgments.processingTimeMs})::int`,
      })
      .from(eventAcknowledgments)
      .where(
        and(
          gte(eventAcknowledgments.acknowledgedAt, timeWindow),
          eq(eventAcknowledgments.status, "success")
        )
      );

    const avgProcessingTime = avgProcessingTimeResult[0]?.avg || 0;

    // Event type breakdown
    const eventTypeBreakdown = await db
      .select({
        eventType: subscriptionEvents.eventType,
        count: sql<number>`count(*)::int`,
      })
      .from(subscriptionEvents)
      .where(gte(subscriptionEvents.createdAt, timeWindow))
      .groupBy(subscriptionEvents.eventType);

    // Calculate success rate
    const successRate =
      totalEvents > 0 ? ((successfulAcks / totalEvents) * 100).toFixed(2) : "0";

    const deliveryRate =
      totalEvents > 0 ? ((totalAcks / totalEvents) * 100).toFixed(2) : "0";

    const retryRate =
      totalEvents > 0 ? ((totalRetries / totalEvents) * 100).toFixed(2) : "0";

    return NextResponse.json({
      success: true,
      timeWindow: {
        hours,
        start: timeWindow.toISOString(),
        end: new Date().toISOString(),
      },
      events: {
        total: totalEvents,
        acknowledged: totalAcks,
        successful: successfulAcks,
        failed: failedAcks,
        unacknowledged: Math.max(0, totalEvents - totalAcks),
      },
      retries: {
        total: totalRetries,
        successful: successfulRetries,
        failed: failedRetries,
      },
      deadLetterQueue: dlqStats,
      performance: {
        successRate: `${successRate}%`,
        deliveryRate: `${deliveryRate}%`,
        retryRate: `${retryRate}%`,
        avgProcessingTimeMs: avgProcessingTime,
      },
      eventTypeBreakdown,
    });
  } catch (error) {
    console.error("[Monitoring API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch monitoring data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
