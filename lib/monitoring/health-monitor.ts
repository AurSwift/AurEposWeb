/**
 * Health Monitor
 * Checks system health metrics and triggers alerts when thresholds are exceeded
 */

import { db } from "@/lib/db";
import {
  licenseHealthMetrics,
  deadLetterQueue,
  failurePatterns,
  eventAcknowledgments,
} from "@/lib/db/schema";
import { eq, gte, sql } from "drizzle-orm";
import { sendAlert } from "./alert-manager";
import { ALERT_THRESHOLDS } from "./alert-config";

/**
 * Monitor health scores and send alerts for critical/degraded licenses
 */
export async function monitorHealthScores(): Promise<{
  checked: number;
  alerts: number;
}> {
  let alertCount = 0;

  // Get all licenses with critical or degraded health
  const unhealthyLicenses = await db
    .select()
    .from(licenseHealthMetrics)
    .where(
      sql`${licenseHealthMetrics.healthStatus} in ('critical', 'degraded')`
    );

  for (const license of unhealthyLicenses) {
    if (license.healthScore < ALERT_THRESHOLDS.healthScore.critical) {
      // Critical health score
      await sendAlert(
        "health_score_critical",
        "critical",
        `Critical Health Score: ${license.licenseKey}`,
        `License ${license.licenseKey} has a critical health score of ${license.healthScore}/100. Immediate attention required.`,
        {
          healthScore: license.healthScore,
          eventSuccessRate: license.eventSuccessRate,
          totalFailures: license.totalFailures,
          totalDlqEvents: license.totalDlqEvents,
          lastFailureAt: license.lastFailureAt?.toISOString() || "N/A",
        },
        license.licenseKey
      );
      alertCount++;
    } else if (license.healthScore < ALERT_THRESHOLDS.healthScore.degraded) {
      // Degraded health score
      await sendAlert(
        "health_score_degraded",
        "warning",
        `Degraded Health Score: ${license.licenseKey}`,
        `License ${license.licenseKey} has a degraded health score of ${license.healthScore}/100. Monitor closely.`,
        {
          healthScore: license.healthScore,
          eventSuccessRate: license.eventSuccessRate,
          totalFailures: license.totalFailures,
        },
        license.licenseKey
      );
      alertCount++;
    }
  }

  return {
    checked: unhealthyLicenses.length,
    alerts: alertCount,
  };
}

/**
 * Monitor DLQ size and send alerts when threshold exceeded
 */
export async function monitorDLQSize(): Promise<{
  totalDlqEvents: number;
  alerts: number;
}> {
  let alertCount = 0;

  // Get total DLQ count
  const totalDlq = await db
    .select({ count: sql<number>`count(*)` })
    .from(deadLetterQueue)
    .where(eq(deadLetterQueue.status, "pending_review"));

  const dlqCount = Number(totalDlq[0]?.count || 0);

  if (dlqCount >= ALERT_THRESHOLDS.dlqSize.critical) {
    // Critical DLQ size
    await sendAlert(
      "dlq_size_critical",
      "critical",
      `Critical DLQ Size: ${dlqCount} Events`,
      `Dead Letter Queue has reached critical size with ${dlqCount} unresolved events. Immediate action required.`,
      {
        dlqCount,
        threshold: ALERT_THRESHOLDS.dlqSize.critical,
      }
    );
    alertCount++;
  } else if (dlqCount >= ALERT_THRESHOLDS.dlqSize.warning) {
    // Warning DLQ size
    await sendAlert(
      "dlq_size_warning",
      "warning",
      `DLQ Size Warning: ${dlqCount} Events`,
      `Dead Letter Queue has ${dlqCount} unresolved events. Review and resolve failed events.`,
      {
        dlqCount,
        threshold: ALERT_THRESHOLDS.dlqSize.warning,
      }
    );
    alertCount++;
  }

  return {
    totalDlqEvents: dlqCount,
    alerts: alertCount,
  };
}

/**
 * Monitor failure rates and send alerts
 */
export async function monitorFailureRates(): Promise<{
  checked: number;
  alerts: number;
}> {
  let alertCount = 0;

  // Get failure rates for last hour by license
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const failureRates = await db
    .select({
      licenseKey: eventAcknowledgments.licenseKey,
      totalEvents: sql<number>`count(*)`,
      failedEvents: sql<number>`count(*) filter (where status = 'failed')`,
    })
    .from(eventAcknowledgments)
    .where(gte(eventAcknowledgments.acknowledgedAt, oneHourAgo))
    .groupBy(eventAcknowledgments.licenseKey)
    .having(sql`count(*) >= 10`); // Only check licenses with at least 10 events

  for (const rate of failureRates) {
    const totalEvents = Number(rate.totalEvents);
    const failedEvents = Number(rate.failedEvents);
    const failureRate = (failedEvents / totalEvents) * 100;

    if (failureRate >= ALERT_THRESHOLDS.failureRate.critical) {
      // Critical failure rate
      await sendAlert(
        "failure_rate_critical",
        "critical",
        `Critical Failure Rate: ${rate.licenseKey}`,
        `License ${
          rate.licenseKey
        } has a critical failure rate of ${failureRate.toFixed(
          1
        )}% in the last hour (${failedEvents}/${totalEvents} events failed).`,
        {
          failureRate: failureRate.toFixed(1),
          failedEvents,
          totalEvents,
        },
        rate.licenseKey
      );
      alertCount++;
    } else if (failureRate >= ALERT_THRESHOLDS.failureRate.warning) {
      // Warning failure rate
      await sendAlert(
        "failure_rate_warning",
        "warning",
        `High Failure Rate: ${rate.licenseKey}`,
        `License ${
          rate.licenseKey
        } has a high failure rate of ${failureRate.toFixed(
          1
        )}% in the last hour (${failedEvents}/${totalEvents} events failed).`,
        {
          failureRate: failureRate.toFixed(1),
          failedEvents,
          totalEvents,
        },
        rate.licenseKey
      );
      alertCount++;
    }
  }

  return {
    checked: failureRates.length,
    alerts: alertCount,
  };
}

/**
 * Monitor active failure patterns and send alerts
 */
export async function monitorFailurePatterns(): Promise<{
  activePatterns: number;
  alerts: number;
}> {
  let alertCount = 0;

  // Get active critical patterns
  const criticalPatterns = await db
    .select()
    .from(failurePatterns)
    .where(
      sql`${failurePatterns.status} = 'active' AND ${failurePatterns.severity} in ('high', 'critical')`
    );

  for (const pattern of criticalPatterns) {
    await sendAlert(
      "pattern_detected",
      pattern.severity === "critical" ? "critical" : "warning",
      `Failure Pattern Detected: ${pattern.patternType}`,
      `${pattern.description} (${pattern.occurrenceCount} occurrences)`,
      {
        patternType: pattern.patternType,
        severity: pattern.severity,
        occurrenceCount: pattern.occurrenceCount,
        firstDetected: pattern.firstDetectedAt.toISOString(),
        lastDetected: pattern.lastDetectedAt.toISOString(),
      },
      pattern.licenseKey || undefined
    );
    alertCount++;
  }

  return {
    activePatterns: criticalPatterns.length,
    alerts: alertCount,
  };
}

/**
 * Run all health checks and send alerts
 */
export async function runHealthMonitoring(): Promise<{
  healthScores: { checked: number; alerts: number };
  dlqSize: { totalDlqEvents: number; alerts: number };
  failureRates: { checked: number; alerts: number };
  failurePatterns: { activePatterns: number; alerts: number };
  totalAlerts: number;
}> {
  const [healthScores, dlqSize, failureRates, failurePatterns] =
    await Promise.all([
      monitorHealthScores(),
      monitorDLQSize(),
      monitorFailureRates(),
      monitorFailurePatterns(),
    ]);

  const totalAlerts =
    healthScores.alerts +
    dlqSize.alerts +
    failureRates.alerts +
    failurePatterns.alerts;

  return {
    healthScores,
    dlqSize,
    failureRates,
    failurePatterns,
    totalAlerts,
  };
}
