/**
 * License Health Scorer
 * Phase 5: Advanced Analytics
 *
 * Calculates comprehensive health scores for licenses based on:
 * - Event success rate
 * - Processing performance
 * - Failure frequency
 * - Recovery capability
 * - Active failure patterns
 */

import { db } from "@/lib/db";
import {
  eventAcknowledgments,
  deadLetterQueue,
  eventRetryHistory,
  licenseHealthMetrics,
  failurePatterns,
  type NewLicenseHealthMetric,
} from "@/lib/db/schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { getActiveFailurePatterns } from "./failure-pattern-analyzer";

/**
 * Health Score Weights
 * Total must equal 100
 */
const HEALTH_WEIGHTS = {
  SUCCESS_RATE: 40, // Most important: are events being processed?
  PROCESSING_PERFORMANCE: 20, // Is processing fast?
  FAILURE_FREQUENCY: 20, // How often do failures occur?
  RECOVERY_CAPABILITY: 10, // Can it recover from failures?
  FAILURE_PATTERNS: 10, // Are there active failure patterns?
};

/**
 * Health Status Thresholds
 */
const HEALTH_STATUS_THRESHOLDS = {
  HEALTHY: 80,
  DEGRADED: 60,
  CRITICAL: 40,
  // Below 40 = inactive
};

/**
 * Performance Thresholds (milliseconds)
 */
const PERFORMANCE_THRESHOLDS = {
  EXCELLENT: 100,
  GOOD: 500,
  ACCEPTABLE: 1000,
  SLOW: 2000,
  // Above 2000 = very slow
};

/**
 * Health Score Result Interface
 */
export interface HealthScoreResult {
  licenseKey: string;
  healthScore: number;
  healthStatus: "healthy" | "degraded" | "critical" | "inactive";
  eventSuccessRate: number;
  avgProcessingTimeMs: number;
  totalEventsProcessed: number;
  totalFailures: number;
  totalRetries: number;
  totalDlqEvents: number;
  lastEventAt: Date | null;
  lastFailureAt: Date | null;
  performanceTrend: "improving" | "stable" | "degrading";
  failurePatterns: string[];
  recommendations: string[];
}

/**
 * Calculate Health Score for a License
 */
export async function calculateHealthScore(
  licenseKey: string,
  timeWindowHours: number = 24
): Promise<HealthScoreResult> {
  const startTime = new Date(
    Date.now() - timeWindowHours * 60 * 60 * 1000
  );

  // 1. Get event statistics
  const eventStats = await getEventStatistics(licenseKey, startTime);

  // 2. Calculate component scores
  const successScore = calculateSuccessScore(eventStats.successRate);
  const performanceScore = calculatePerformanceScore(
    eventStats.avgProcessingTimeMs
  );
  const failureFrequencyScore = calculateFailureFrequencyScore(
    eventStats.totalEventsProcessed,
    eventStats.totalFailures
  );
  const recoveryScore = calculateRecoveryScore(
    eventStats.totalRetries,
    eventStats.totalDlqEvents
  );

  // 3. Get active failure patterns
  const activePatterns = await getActiveFailurePatterns(licenseKey);
  const patternScore = calculatePatternScore(activePatterns.length);

  // 4. Calculate weighted health score
  const healthScore = Math.round(
    (successScore * HEALTH_WEIGHTS.SUCCESS_RATE +
      performanceScore * HEALTH_WEIGHTS.PROCESSING_PERFORMANCE +
      failureFrequencyScore * HEALTH_WEIGHTS.FAILURE_FREQUENCY +
      recoveryScore * HEALTH_WEIGHTS.RECOVERY_CAPABILITY +
      patternScore * HEALTH_WEIGHTS.FAILURE_PATTERNS) /
      100
  );

  // 5. Determine health status
  const healthStatus = determineHealthStatus(
    healthScore,
    eventStats.lastEventAt
  );

  // 6. Determine performance trend
  const performanceTrend = await determinePerformanceTrend(licenseKey);

  // 7. Generate recommendations
  const recommendations = generateRecommendations({
    successScore,
    performanceScore,
    failureFrequencyScore,
    recoveryScore,
    patternScore,
    activePatterns,
    eventStats,
  });

  const result: HealthScoreResult = {
    licenseKey,
    healthScore,
    healthStatus,
    eventSuccessRate: eventStats.successRate,
    avgProcessingTimeMs: eventStats.avgProcessingTimeMs,
    totalEventsProcessed: eventStats.totalEventsProcessed,
    totalFailures: eventStats.totalFailures,
    totalRetries: eventStats.totalRetries,
    totalDlqEvents: eventStats.totalDlqEvents,
    lastEventAt: eventStats.lastEventAt,
    lastFailureAt: eventStats.lastFailureAt,
    performanceTrend,
    failurePatterns: activePatterns.map((p) => p.description),
    recommendations,
  };

  // 8. Store health metrics in database
  await storeHealthMetrics(result, activePatterns);

  return result;
}

/**
 * Get Event Statistics for License
 */
async function getEventStatistics(licenseKey: string, startTime: Date) {
  // Get acknowledgment stats
  const ackStats = await db
    .select({
      totalEvents: sql<number>`count(*)`,
      successfulEvents: sql<number>`count(*) filter (where status = 'success')`,
      failedEvents: sql<number>`count(*) filter (where status = 'failed')`,
      avgProcessingTime: sql<number>`avg(${eventAcknowledgments.processingTimeMs})`,
      lastEventAt: sql<string>`max(${eventAcknowledgments.acknowledgedAt})`,
      lastFailureAt: sql<string>`max(${eventAcknowledgments.acknowledgedAt}) filter (where status = 'failed')`,
    })
    .from(eventAcknowledgments)
    .where(
      and(
        eq(eventAcknowledgments.licenseKey, licenseKey),
        gte(eventAcknowledgments.acknowledgedAt, startTime)
      )
    );

  // Get retry stats
  const retryStats = await db
    .select({
      totalRetries: sql<number>`count(*)`,
    })
    .from(eventRetryHistory)
    .where(
      and(
        sql`${eventRetryHistory.eventId} in (select event_id from ${eventAcknowledgments} where license_key = ${licenseKey})`,
        gte(eventRetryHistory.attemptedAt, startTime)
      )
    );

  // Get DLQ stats
  const dlqStats = await db
    .select({
      totalDlqEvents: sql<number>`count(*)`,
    })
    .from(deadLetterQueue)
    .where(eq(deadLetterQueue.licenseKey, licenseKey));

  const totalEvents = Number(ackStats[0]?.totalEvents || 0);
  const successfulEvents = Number(ackStats[0]?.successfulEvents || 0);
  const failedEvents = Number(ackStats[0]?.failedEvents || 0);
  const successRate =
    totalEvents > 0 ? (successfulEvents / totalEvents) * 100 : 100;

  return {
    totalEventsProcessed: totalEvents,
    totalFailures: failedEvents,
    successRate,
    avgProcessingTimeMs: Math.round(
      Number(ackStats[0]?.avgProcessingTime || 0)
    ),
    lastEventAt: ackStats[0]?.lastEventAt
      ? new Date(ackStats[0].lastEventAt)
      : null,
    lastFailureAt: ackStats[0]?.lastFailureAt
      ? new Date(ackStats[0].lastFailureAt)
      : null,
    totalRetries: Number(retryStats[0]?.totalRetries || 0),
    totalDlqEvents: Number(dlqStats[0]?.totalDlqEvents || 0),
  };
}

/**
 * Calculate Success Score (0-100)
 */
function calculateSuccessScore(successRate: number): number {
  // Linear scale: 100% success = 100 points, 0% success = 0 points
  return Math.round(successRate);
}

/**
 * Calculate Performance Score (0-100)
 */
function calculatePerformanceScore(avgProcessingTimeMs: number): number {
  if (avgProcessingTimeMs === 0) return 100; // No data = perfect score
  if (avgProcessingTimeMs <= PERFORMANCE_THRESHOLDS.EXCELLENT) return 100;
  if (avgProcessingTimeMs <= PERFORMANCE_THRESHOLDS.GOOD) return 90;
  if (avgProcessingTimeMs <= PERFORMANCE_THRESHOLDS.ACCEPTABLE) return 70;
  if (avgProcessingTimeMs <= PERFORMANCE_THRESHOLDS.SLOW) return 50;
  return 30; // Very slow
}

/**
 * Calculate Failure Frequency Score (0-100)
 */
function calculateFailureFrequencyScore(
  totalEvents: number,
  totalFailures: number
): number {
  if (totalEvents === 0) return 100; // No events = no failures

  const failureRate = (totalFailures / totalEvents) * 100;

  // Inverse scale: fewer failures = higher score
  if (failureRate === 0) return 100;
  if (failureRate <= 1) return 95;
  if (failureRate <= 5) return 85;
  if (failureRate <= 10) return 70;
  if (failureRate <= 20) return 50;
  return 30;
}

/**
 * Calculate Recovery Score (0-100)
 */
function calculateRecoveryScore(
  totalRetries: number,
  totalDlqEvents: number
): number {
  if (totalRetries === 0 && totalDlqEvents === 0) return 100; // No failures to recover from

  // Good recovery: retries work, few DLQ events
  // Poor recovery: many DLQ events despite retries

  if (totalDlqEvents === 0) return 100; // All retries successful
  if (totalDlqEvents === 1) return 90;
  if (totalDlqEvents <= 3) return 80;
  if (totalDlqEvents <= 5) return 60;
  if (totalDlqEvents <= 10) return 40;
  return 20;
}

/**
 * Calculate Pattern Score (0-100)
 */
function calculatePatternScore(activePatternCount: number): number {
  // No active patterns = perfect score
  if (activePatternCount === 0) return 100;
  if (activePatternCount === 1) return 85;
  if (activePatternCount === 2) return 70;
  if (activePatternCount <= 4) return 50;
  return 30;
}

/**
 * Determine Health Status
 */
function determineHealthStatus(
  healthScore: number,
  lastEventAt: Date | null
): "healthy" | "degraded" | "critical" | "inactive" {
  // Check if inactive (no events in 24 hours)
  if (!lastEventAt) return "inactive";

  const hoursSinceLastEvent =
    (Date.now() - lastEventAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceLastEvent > 24) return "inactive";

  // Check health score thresholds
  if (healthScore >= HEALTH_STATUS_THRESHOLDS.HEALTHY) return "healthy";
  if (healthScore >= HEALTH_STATUS_THRESHOLDS.DEGRADED) return "degraded";
  if (healthScore >= HEALTH_STATUS_THRESHOLDS.CRITICAL) return "critical";
  return "critical";
}

/**
 * Determine Performance Trend
 */
async function determinePerformanceTrend(
  licenseKey: string
): Promise<"improving" | "stable" | "degrading"> {
  // Get health metrics from last two calculations
  const recentMetrics = await db
    .select()
    .from(licenseHealthMetrics)
    .where(eq(licenseHealthMetrics.licenseKey, licenseKey))
    .orderBy(desc(licenseHealthMetrics.updatedAt))
    .limit(2);

  if (recentMetrics.length < 2) return "stable";

  const current = recentMetrics[0];
  const previous = recentMetrics[1];

  const scoreDiff = current.healthScore - previous.healthScore;

  if (scoreDiff >= 5) return "improving";
  if (scoreDiff <= -5) return "degrading";
  return "stable";
}

/**
 * Generate Recommendations
 */
function generateRecommendations(context: {
  successScore: number;
  performanceScore: number;
  failureFrequencyScore: number;
  recoveryScore: number;
  patternScore: number;
  activePatterns: any[];
  eventStats: any;
}): string[] {
  const recommendations: string[] = [];

  // Success rate recommendations
  if (context.successScore < 90) {
    recommendations.push(
      "Low success rate detected. Investigate failure causes and implement fixes."
    );
  }

  // Performance recommendations
  if (context.performanceScore < 70) {
    recommendations.push(
      `Slow processing detected (avg ${context.eventStats.avgProcessingTimeMs}ms). Optimize event handlers.`
    );
  }

  // Failure frequency recommendations
  if (context.failureFrequencyScore < 70) {
    recommendations.push(
      "High failure frequency. Review error patterns and implement preventive measures."
    );
  }

  // Recovery recommendations
  if (context.recoveryScore < 70) {
    recommendations.push(
      `${context.eventStats.totalDlqEvents} events in DLQ. Review and resolve failed events.`
    );
  }

  // Pattern recommendations
  if (context.activePatterns.length > 0) {
    for (const pattern of context.activePatterns) {
      recommendations.push(`Active pattern: ${pattern.description}`);
    }
  }

  // No issues
  if (recommendations.length === 0) {
    recommendations.push("System operating normally. No action required.");
  }

  return recommendations;
}

/**
 * Store Health Metrics in Database
 */
async function storeHealthMetrics(
  result: HealthScoreResult,
  activePatterns: any[]
): Promise<void> {
  const metrics: NewLicenseHealthMetric = {
    licenseKey: result.licenseKey,
    healthScore: result.healthScore,
    eventSuccessRate: result.eventSuccessRate.toFixed(2),
    avgProcessingTimeMs: result.avgProcessingTimeMs,
    totalEventsProcessed: result.totalEventsProcessed,
    totalFailures: result.totalFailures,
    totalRetries: result.totalRetries,
    totalDlqEvents: result.totalDlqEvents,
    lastEventAt: result.lastEventAt,
    lastFailureAt: result.lastFailureAt,
    healthStatus: result.healthStatus,
    failurePatterns: activePatterns.map((p) => ({
      type: p.patternType,
      description: p.description,
      severity: p.severity,
    })),
    performanceTrend: result.performanceTrend,
  };

  // Upsert (insert or update)
  await db
    .insert(licenseHealthMetrics)
    .values(metrics)
    .onConflictDoUpdate({
      target: [licenseHealthMetrics.licenseKey],
      set: {
        healthScore: metrics.healthScore,
        eventSuccessRate: metrics.eventSuccessRate,
        avgProcessingTimeMs: metrics.avgProcessingTimeMs,
        totalEventsProcessed: metrics.totalEventsProcessed,
        totalFailures: metrics.totalFailures,
        totalRetries: metrics.totalRetries,
        totalDlqEvents: metrics.totalDlqEvents,
        lastEventAt: metrics.lastEventAt,
        lastFailureAt: metrics.lastFailureAt,
        healthStatus: metrics.healthStatus,
        failurePatterns: metrics.failurePatterns,
        performanceTrend: metrics.performanceTrend,
        updatedAt: new Date(),
      },
    });
}

/**
 * Get Health Metrics for License
 */
export async function getHealthMetrics(licenseKey: string) {
  const metrics = await db
    .select()
    .from(licenseHealthMetrics)
    .where(eq(licenseHealthMetrics.licenseKey, licenseKey))
    .limit(1);

  return metrics[0] || null;
}

/**
 * Get All Unhealthy Licenses
 */
export async function getUnhealthyLicenses() {
  return await db
    .select()
    .from(licenseHealthMetrics)
    .where(
      sql`${licenseHealthMetrics.healthStatus} in ('degraded', 'critical')`
    )
    .orderBy(licenseHealthMetrics.healthScore);
}

/**
 * Calculate Health Scores for All Active Licenses
 */
export async function calculateAllHealthScores(): Promise<HealthScoreResult[]> {
  // Get all unique license keys from acknowledgments in last 7 days
  const activeLicenses = await db
    .selectDistinct({
      licenseKey: eventAcknowledgments.licenseKey,
    })
    .from(eventAcknowledgments)
    .where(
      gte(
        eventAcknowledgments.acknowledgedAt,
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      )
    );

  const results: HealthScoreResult[] = [];

  for (const { licenseKey } of activeLicenses) {
    const result = await calculateHealthScore(licenseKey);
    results.push(result);
  }

  return results;
}
