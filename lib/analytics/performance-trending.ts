/**
 * Performance Trending System
 * Phase 5: Advanced Analytics
 *
 * Aggregates performance metrics into hourly time-series data
 * for trend analysis, forecasting, and capacity planning.
 */

import { db } from "@/lib/db";
import {
  eventAcknowledgments,
  deadLetterQueue,
  eventRetryHistory,
  performanceMetrics,
  type NewPerformanceMetric,
} from "@/lib/db/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

/**
 * Performance Trend Result Interface
 */
export interface PerformanceTrend {
  timestamp: Date;
  eventsProcessed: number;
  successfulEvents: number;
  failedEvents: number;
  successRate: number;
  avgProcessingTimeMs: number;
  minProcessingTimeMs: number;
  maxProcessingTimeMs: number;
  p95ProcessingTimeMs: number;
  eventsRetried: number;
  eventsToDlq: number;
}

/**
 * Aggregate Performance Metrics
 * Collects hourly metrics for all licenses or specific license
 */
export async function aggregatePerformanceMetrics(
  licenseKey?: string,
  timestamp?: Date
): Promise<void> {
  const targetTimestamp = timestamp || new Date();
  // Round down to the hour
  targetTimestamp.setMinutes(0, 0, 0);

  const startTime = new Date(targetTimestamp);
  const endTime = new Date(targetTimestamp.getTime() + 60 * 60 * 1000); // +1 hour

  // Get all acknowledgments in this hour
  const whereConditions = [
    gte(eventAcknowledgments.acknowledgedAt, startTime),
    lte(eventAcknowledgments.acknowledgedAt, endTime),
  ];

  if (licenseKey) {
    whereConditions.push(eq(eventAcknowledgments.licenseKey, licenseKey));
  }

  // Aggregate by license key
  const aggregated = await db
    .select({
      licenseKey: eventAcknowledgments.licenseKey,
      eventsProcessed: sql<number>`count(*)`,
      successfulEvents: sql<number>`count(*) filter (where status = 'success')`,
      failedEvents: sql<number>`count(*) filter (where status = 'failed')`,
      avgProcessingTime: sql<number>`avg(${eventAcknowledgments.processingTimeMs})`,
      minProcessingTime: sql<number>`min(${eventAcknowledgments.processingTimeMs})`,
      maxProcessingTime: sql<number>`max(${eventAcknowledgments.processingTimeMs})`,
      p95ProcessingTime: sql<number>`percentile_cont(0.95) within group (order by ${eventAcknowledgments.processingTimeMs})`,
    })
    .from(eventAcknowledgments)
    .where(and(...whereConditions))
    .groupBy(eventAcknowledgments.licenseKey);

  // For each license, get retry and DLQ stats
  for (const agg of aggregated) {
    // Get retry count
    const retryCount = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(eventRetryHistory)
      .where(
        and(
          sql`${eventRetryHistory.eventId} in (
            select event_id from ${eventAcknowledgments}
            where license_key = ${agg.licenseKey}
            and acknowledged_at >= ${startTime.toISOString()}
            and acknowledged_at < ${endTime.toISOString()}
          )`,
          gte(eventRetryHistory.attemptedAt, startTime),
          lte(eventRetryHistory.attemptedAt, endTime)
        )
      );

    // Get DLQ count
    const dlqCount = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(deadLetterQueue)
      .where(
        and(
          eq(deadLetterQueue.licenseKey, agg.licenseKey),
          gte(deadLetterQueue.failedAt, startTime),
          lte(deadLetterQueue.failedAt, endTime)
        )
      );

    // Insert performance metric
    const metric: NewPerformanceMetric = {
      licenseKey: agg.licenseKey,
      timestamp: targetTimestamp,
      eventsProcessed: Number(agg.eventsProcessed),
      successfulEvents: Number(agg.successfulEvents),
      failedEvents: Number(agg.failedEvents),
      avgProcessingTimeMs: Math.round(Number(agg.avgProcessingTime || 0)),
      minProcessingTimeMs: Math.round(Number(agg.minProcessingTime || 0)),
      maxProcessingTimeMs: Math.round(Number(agg.maxProcessingTime || 0)),
      p95ProcessingTimeMs: Math.round(Number(agg.p95ProcessingTime || 0)),
      eventsRetried: Number(retryCount[0]?.count || 0),
      eventsToDlq: Number(dlqCount[0]?.count || 0),
    };

    await db.insert(performanceMetrics).values(metric);
  }

  // Also create system-wide metric (licenseKey = null)
  if (!licenseKey) {
    const systemWide = await db
      .select({
        eventsProcessed: sql<number>`count(*)`,
        successfulEvents: sql<number>`count(*) filter (where status = 'success')`,
        failedEvents: sql<number>`count(*) filter (where status = 'failed')`,
        avgProcessingTime: sql<number>`avg(${eventAcknowledgments.processingTimeMs})`,
        minProcessingTime: sql<number>`min(${eventAcknowledgments.processingTimeMs})`,
        maxProcessingTime: sql<number>`max(${eventAcknowledgments.processingTimeMs})`,
        p95ProcessingTime: sql<number>`percentile_cont(0.95) within group (order by ${eventAcknowledgments.processingTimeMs})`,
      })
      .from(eventAcknowledgments)
      .where(
        and(
          gte(eventAcknowledgments.acknowledgedAt, startTime),
          lte(eventAcknowledgments.acknowledgedAt, endTime)
        )
      );

    if (systemWide[0] && Number(systemWide[0].eventsProcessed) > 0) {
      const totalRetries = await db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(eventRetryHistory)
        .where(
          and(
            gte(eventRetryHistory.attemptedAt, startTime),
            lte(eventRetryHistory.attemptedAt, endTime)
          )
        );

      const totalDlq = await db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(deadLetterQueue)
        .where(
          and(
            gte(deadLetterQueue.failedAt, startTime),
            lte(deadLetterQueue.failedAt, endTime)
          )
        );

      const systemMetric: NewPerformanceMetric = {
        licenseKey: null,
        timestamp: targetTimestamp,
        eventsProcessed: Number(systemWide[0].eventsProcessed),
        successfulEvents: Number(systemWide[0].successfulEvents),
        failedEvents: Number(systemWide[0].failedEvents),
        avgProcessingTimeMs: Math.round(
          Number(systemWide[0].avgProcessingTime || 0)
        ),
        minProcessingTimeMs: Math.round(
          Number(systemWide[0].minProcessingTime || 0)
        ),
        maxProcessingTimeMs: Math.round(
          Number(systemWide[0].maxProcessingTime || 0)
        ),
        p95ProcessingTimeMs: Math.round(
          Number(systemWide[0].p95ProcessingTime || 0)
        ),
        eventsRetried: Number(totalRetries[0]?.count || 0),
        eventsToDlq: Number(totalDlq[0]?.count || 0),
      };

      await db.insert(performanceMetrics).values(systemMetric);
    }
  }
}

/**
 * Get Performance Trend
 * Returns time-series performance data
 */
export async function getPerformanceTrend(
  licenseKey: string | null,
  startDate: Date,
  endDate: Date
): Promise<PerformanceTrend[]> {
  const whereConditions = [
    gte(performanceMetrics.timestamp, startDate),
    lte(performanceMetrics.timestamp, endDate),
  ];

  if (licenseKey === null) {
    whereConditions.push(sql`${performanceMetrics.licenseKey} is null`);
  } else {
    whereConditions.push(eq(performanceMetrics.licenseKey, licenseKey));
  }

  const metrics = await db
    .select()
    .from(performanceMetrics)
    .where(and(...whereConditions))
    .orderBy(performanceMetrics.timestamp);

  return metrics.map((m) => {
    const successRate =
      m.eventsProcessed > 0
        ? (m.successfulEvents / m.eventsProcessed) * 100
        : 100;

    return {
      timestamp: new Date(m.timestamp),
      eventsProcessed: m.eventsProcessed,
      successfulEvents: m.successfulEvents,
      failedEvents: m.failedEvents,
      successRate,
      avgProcessingTimeMs: m.avgProcessingTimeMs || 0,
      minProcessingTimeMs: m.minProcessingTimeMs || 0,
      maxProcessingTimeMs: m.maxProcessingTimeMs || 0,
      p95ProcessingTimeMs: m.p95ProcessingTimeMs || 0,
      eventsRetried: m.eventsRetried,
      eventsToDlq: m.eventsToDlq,
    };
  });
}

/**
 * Get Performance Summary Statistics
 */
export async function getPerformanceSummary(
  licenseKey: string | null,
  startDate: Date,
  endDate: Date
) {
  const trend = await getPerformanceTrend(licenseKey, startDate, endDate);

  if (trend.length === 0) {
    return null;
  }

  // Calculate summary statistics
  const totalEvents = trend.reduce((sum, t) => sum + t.eventsProcessed, 0);
  const totalSuccessful = trend.reduce((sum, t) => sum + t.successfulEvents, 0);
  const totalFailed = trend.reduce((sum, t) => sum + t.failedEvents, 0);
  const totalRetries = trend.reduce((sum, t) => sum + t.eventsRetried, 0);
  const totalDlq = trend.reduce((sum, t) => sum + t.eventsToDlq, 0);

  const avgSuccessRate =
    trend.reduce((sum, t) => sum + t.successRate, 0) / trend.length;
  const avgProcessingTime =
    trend.reduce((sum, t) => sum + t.avgProcessingTimeMs, 0) / trend.length;

  // Calculate trend direction
  const recentTrend = trend.slice(-6); // Last 6 hours
  const olderTrend = trend.slice(0, Math.min(6, trend.length - 6));

  let trendDirection: "improving" | "stable" | "degrading" = "stable";

  if (recentTrend.length > 0 && olderTrend.length > 0) {
    const recentAvgSuccess =
      recentTrend.reduce((sum, t) => sum + t.successRate, 0) /
      recentTrend.length;
    const olderAvgSuccess =
      olderTrend.reduce((sum, t) => sum + t.successRate, 0) / olderTrend.length;

    if (recentAvgSuccess > olderAvgSuccess + 5) {
      trendDirection = "improving";
    } else if (recentAvgSuccess < olderAvgSuccess - 5) {
      trendDirection = "degrading";
    }
  }

  return {
    period: {
      start: startDate,
      end: endDate,
      hours: trend.length,
    },
    totals: {
      eventsProcessed: totalEvents,
      successfulEvents: totalSuccessful,
      failedEvents: totalFailed,
      eventsRetried: totalRetries,
      eventsToDlq: totalDlq,
    },
    averages: {
      successRate: avgSuccessRate,
      processingTimeMs: avgProcessingTime,
      eventsPerHour: totalEvents / trend.length,
    },
    trend: {
      direction: trendDirection,
      dataPoints: trend,
    },
  };
}

/**
 * Predict Future Performance
 * Simple linear regression for next N hours
 */
export async function predictPerformance(
  licenseKey: string | null,
  hoursAhead: number = 24
) {
  // Get last 7 days of data
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  const trend = await getPerformanceTrend(licenseKey, startDate, endDate);

  if (trend.length < 24) {
    return {
      prediction: "insufficient_data",
      message: "Need at least 24 hours of data for predictions",
    };
  }

  // Calculate linear regression on success rate
  const dataPoints = trend.map((t, index) => ({
    x: index,
    y: t.successRate,
  }));

  const { slope, intercept } = linearRegression(dataPoints);

  // Predict next N hours
  const predictions = [];
  for (let i = 1; i <= hoursAhead; i++) {
    const x = trend.length + i;
    const predictedSuccessRate = Math.max(
      0,
      Math.min(100, slope * x + intercept)
    );

    predictions.push({
      timestamp: new Date(endDate.getTime() + i * 60 * 60 * 1000),
      predictedSuccessRate,
    });
  }

  // Determine forecast
  const avgPredictedRate =
    predictions.reduce((sum, p) => sum + p.predictedSuccessRate, 0) /
    predictions.length;

  let forecast: "positive" | "neutral" | "concerning";
  if (avgPredictedRate >= 95) {
    forecast = "positive";
  } else if (avgPredictedRate >= 85) {
    forecast = "neutral";
  } else {
    forecast = "concerning";
  }

  return {
    prediction: "success",
    forecast,
    avgPredictedSuccessRate: avgPredictedRate,
    predictions,
  };
}

/**
 * Linear Regression Helper
 */
function linearRegression(data: { x: number; y: number }[]) {
  const n = data.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const point of data) {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumXX += point.x * point.x;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

/**
 * Cleanup Old Performance Metrics
 * Remove metrics older than retention period (default 90 days)
 */
export async function cleanupOldMetrics(retentionDays: number = 90) {
  const cutoffDate = new Date(
    Date.now() - retentionDays * 24 * 60 * 60 * 1000
  );

  const deleted = await db
    .delete(performanceMetrics)
    .where(lte(performanceMetrics.timestamp, cutoffDate));

  return { deleted };
}
