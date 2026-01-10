/**
 * Failure Pattern Analyzer
 * Phase 5: Advanced Analytics
 *
 * Analyzes event acknowledgments and DLQ events to detect failure patterns
 * and provide actionable insights for improving system reliability.
 */

import { db } from "@/lib/db";
import {
  eventAcknowledgments,
  deadLetterQueue,
  eventRetryHistory,
  failurePatterns,
  type NewFailurePattern,
} from "@/lib/db/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

/**
 * Pattern Detection Configuration
 */
const PATTERN_THRESHOLDS = {
  // How many similar errors constitute a pattern
  MIN_OCCURRENCE_COUNT: 3,
  // Time window for pattern detection (1 hour)
  PATTERN_WINDOW_HOURS: 1,
  // Burst detection: N failures in M minutes
  BURST_FAILURE_COUNT: 5,
  BURST_WINDOW_MINUTES: 5,
  // Timeout pattern: N timeouts in M minutes
  TIMEOUT_COUNT: 3,
  TIMEOUT_WINDOW_MINUTES: 10,
};

/**
 * Detected Pattern Interface
 */
interface DetectedPattern {
  patternId: string;
  patternType: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  licenseKey?: string;
  occurrenceCount: number;
  metadata: Record<string, unknown>;
}

/**
 * Analyze Failures and Detect Patterns
 */
export async function analyzeFailurePatterns(
  licenseKey?: string,
  timeWindowHours: number = 24
): Promise<DetectedPattern[]> {
  const patterns: DetectedPattern[] = [];
  const startTime = new Date(
    Date.now() - timeWindowHours * 60 * 60 * 1000
  ).toISOString();

  // 1. Detect burst failures (rapid consecutive failures)
  const burstPatterns = await detectBurstFailures(licenseKey, startTime);
  patterns.push(...burstPatterns);

  // 2. Detect timeout patterns
  const timeoutPatterns = await detectTimeoutPatterns(licenseKey, startTime);
  patterns.push(...timeoutPatterns);

  // 3. Detect network error patterns
  const networkPatterns = await detectNetworkErrors(licenseKey, startTime);
  patterns.push(...networkPatterns);

  // 4. Detect parsing/validation errors
  const parsingPatterns = await detectParsingErrors(licenseKey, startTime);
  patterns.push(...parsingPatterns);

  // 5. Detect rate limiting patterns
  const rateLimitPatterns = await detectRateLimitErrors(licenseKey, startTime);
  patterns.push(...rateLimitPatterns);

  // 6. Store detected patterns in database
  await storeDetectedPatterns(patterns);

  return patterns;
}

/**
 * Detect Burst Failure Pattern
 * Rapid consecutive failures in short time window
 */
async function detectBurstFailures(
  licenseKey: string | undefined,
  startTime: string
): Promise<DetectedPattern[]> {
  const patterns: DetectedPattern[] = [];

  // Query failed acknowledgments in time window
  const whereConditions = [
    eq(eventAcknowledgments.status, "failed"),
    gte(eventAcknowledgments.acknowledgedAt, startTime),
  ];

  if (licenseKey) {
    whereConditions.push(eq(eventAcknowledgments.licenseKey, licenseKey));
  }

  const failures = await db
    .select({
      licenseKey: eventAcknowledgments.licenseKey,
      acknowledgedAt: eventAcknowledgments.acknowledgedAt,
      errorMessage: eventAcknowledgments.errorMessage,
    })
    .from(eventAcknowledgments)
    .where(and(...whereConditions))
    .orderBy(desc(eventAcknowledgments.acknowledgedAt));

  // Group by license and detect bursts
  const licenseBursts = new Map<string, Date[]>();

  for (const failure of failures) {
    if (!licenseBursts.has(failure.licenseKey)) {
      licenseBursts.set(failure.licenseKey, []);
    }
    licenseBursts
      .get(failure.licenseKey)!
      .push(new Date(failure.acknowledgedAt));
  }

  // Analyze each license for burst patterns
  for (const [license, timestamps] of licenseBursts.entries()) {
    // Check for N failures within M minutes
    for (let i = 0; i < timestamps.length; i++) {
      const windowStart = timestamps[i];
      const windowEnd = new Date(
        windowStart.getTime() +
          PATTERN_THRESHOLDS.BURST_WINDOW_MINUTES * 60 * 1000
      );

      const burstCount = timestamps.filter(
        (t) => t >= windowStart && t <= windowEnd
      ).length;

      if (burstCount >= PATTERN_THRESHOLDS.BURST_FAILURE_COUNT) {
        patterns.push({
          patternId: `burst_${license}_${windowStart.getTime()}`,
          patternType: "burst_failures",
          description: `${burstCount} failures detected in ${PATTERN_THRESHOLDS.BURST_WINDOW_MINUTES} minutes`,
          severity:
            burstCount >= 10 ? "critical" : burstCount >= 7 ? "high" : "medium",
          licenseKey: license,
          occurrenceCount: burstCount,
          metadata: {
            windowStart: windowStart.toISOString(),
            windowEnd: windowEnd.toISOString(),
            failureCount: burstCount,
          },
        });
        break; // Only report first burst per license
      }
    }
  }

  return patterns;
}

/**
 * Detect Timeout Pattern
 * Repeated timeout errors
 */
async function detectTimeoutPatterns(
  licenseKey: string | undefined,
  startTime: string
): Promise<DetectedPattern[]> {
  const patterns: DetectedPattern[] = [];

  const whereConditions = [
    eq(eventAcknowledgments.status, "failed"),
    gte(eventAcknowledgments.acknowledgedAt, startTime),
  ];

  if (licenseKey) {
    whereConditions.push(eq(eventAcknowledgments.licenseKey, licenseKey));
  }

  const timeoutFailures = await db
    .select({
      licenseKey: eventAcknowledgments.licenseKey,
      errorMessage: eventAcknowledgments.errorMessage,
      count: sql<number>`count(*)`,
    })
    .from(eventAcknowledgments)
    .where(and(...whereConditions))
    .groupBy(eventAcknowledgments.licenseKey, eventAcknowledgments.errorMessage)
    .having(sql`count(*) >= ${PATTERN_THRESHOLDS.TIMEOUT_COUNT}`);

  for (const failure of timeoutFailures) {
    const errorMsg = failure.errorMessage?.toLowerCase() || "";
    if (
      errorMsg.includes("timeout") ||
      errorMsg.includes("timed out") ||
      errorMsg.includes("connection timeout")
    ) {
      patterns.push({
        patternId: `timeout_${failure.licenseKey}_${Date.now()}`,
        patternType: "timeout",
        description: `Repeated timeout errors detected (${failure.count} occurrences)`,
        severity: Number(failure.count) >= 10 ? "high" : "medium",
        licenseKey: failure.licenseKey,
        occurrenceCount: Number(failure.count),
        metadata: {
          errorMessage: failure.errorMessage,
          totalOccurrences: failure.count,
        },
      });
    }
  }

  return patterns;
}

/**
 * Detect Network Error Pattern
 * Network connectivity issues
 */
async function detectNetworkErrors(
  licenseKey: string | undefined,
  startTime: string
): Promise<DetectedPattern[]> {
  const patterns: DetectedPattern[] = [];

  const whereConditions = [
    eq(eventAcknowledgments.status, "failed"),
    gte(eventAcknowledgments.acknowledgedAt, startTime),
  ];

  if (licenseKey) {
    whereConditions.push(eq(eventAcknowledgments.licenseKey, licenseKey));
  }

  const networkFailures = await db
    .select({
      licenseKey: eventAcknowledgments.licenseKey,
      errorMessage: eventAcknowledgments.errorMessage,
      count: sql<number>`count(*)`,
    })
    .from(eventAcknowledgments)
    .where(and(...whereConditions))
    .groupBy(eventAcknowledgments.licenseKey, eventAcknowledgments.errorMessage)
    .having(sql`count(*) >= ${PATTERN_THRESHOLDS.MIN_OCCURRENCE_COUNT}`);

  for (const failure of networkFailures) {
    const errorMsg = failure.errorMessage?.toLowerCase() || "";
    if (
      errorMsg.includes("network") ||
      errorMsg.includes("connection refused") ||
      errorMsg.includes("econnrefused") ||
      errorMsg.includes("dns") ||
      errorMsg.includes("unreachable")
    ) {
      patterns.push({
        patternId: `network_${failure.licenseKey}_${Date.now()}`,
        patternType: "network_error",
        description: `Network connectivity issues detected (${failure.count} occurrences)`,
        severity: Number(failure.count) >= 10 ? "high" : "medium",
        licenseKey: failure.licenseKey,
        occurrenceCount: Number(failure.count),
        metadata: {
          errorMessage: failure.errorMessage,
          totalOccurrences: failure.count,
        },
      });
    }
  }

  return patterns;
}

/**
 * Detect Parsing/Validation Error Pattern
 * Data format or validation issues
 */
async function detectParsingErrors(
  licenseKey: string | undefined,
  startTime: string
): Promise<DetectedPattern[]> {
  const patterns: DetectedPattern[] = [];

  const whereConditions = [
    eq(eventAcknowledgments.status, "failed"),
    gte(eventAcknowledgments.acknowledgedAt, startTime),
  ];

  if (licenseKey) {
    whereConditions.push(eq(eventAcknowledgments.licenseKey, licenseKey));
  }

  const parsingFailures = await db
    .select({
      licenseKey: eventAcknowledgments.licenseKey,
      errorMessage: eventAcknowledgments.errorMessage,
      count: sql<number>`count(*)`,
    })
    .from(eventAcknowledgments)
    .where(and(...whereConditions))
    .groupBy(eventAcknowledgments.licenseKey, eventAcknowledgments.errorMessage)
    .having(sql`count(*) >= ${PATTERN_THRESHOLDS.MIN_OCCURRENCE_COUNT}`);

  for (const failure of parsingFailures) {
    const errorMsg = failure.errorMessage?.toLowerCase() || "";
    if (
      errorMsg.includes("parse") ||
      errorMsg.includes("invalid") ||
      errorMsg.includes("validation") ||
      errorMsg.includes("json") ||
      errorMsg.includes("syntax")
    ) {
      patterns.push({
        patternId: `parsing_${failure.licenseKey}_${Date.now()}`,
        patternType: "parsing_error",
        description: `Data parsing/validation errors detected (${failure.count} occurrences)`,
        severity: "medium",
        licenseKey: failure.licenseKey,
        occurrenceCount: Number(failure.count),
        metadata: {
          errorMessage: failure.errorMessage,
          totalOccurrences: failure.count,
        },
      });
    }
  }

  return patterns;
}

/**
 * Detect Rate Limiting Pattern
 * Too many requests errors
 */
async function detectRateLimitErrors(
  licenseKey: string | undefined,
  startTime: string
): Promise<DetectedPattern[]> {
  const patterns: DetectedPattern[] = [];

  const whereConditions = [
    eq(eventAcknowledgments.status, "failed"),
    gte(eventAcknowledgments.acknowledgedAt, startTime),
  ];

  if (licenseKey) {
    whereConditions.push(eq(eventAcknowledgments.licenseKey, licenseKey));
  }

  const rateLimitFailures = await db
    .select({
      licenseKey: eventAcknowledgments.licenseKey,
      errorMessage: eventAcknowledgments.errorMessage,
      count: sql<number>`count(*)`,
    })
    .from(eventAcknowledgments)
    .where(and(...whereConditions))
    .groupBy(eventAcknowledgments.licenseKey, eventAcknowledgments.errorMessage)
    .having(sql`count(*) >= ${PATTERN_THRESHOLDS.MIN_OCCURRENCE_COUNT}`);

  for (const failure of rateLimitFailures) {
    const errorMsg = failure.errorMessage?.toLowerCase() || "";
    if (
      errorMsg.includes("rate limit") ||
      errorMsg.includes("too many requests") ||
      errorMsg.includes("429") ||
      errorMsg.includes("quota exceeded")
    ) {
      patterns.push({
        patternId: `rate_limit_${failure.licenseKey}_${Date.now()}`,
        patternType: "rate_limit",
        description: `Rate limiting detected (${failure.count} occurrences)`,
        severity: "low",
        licenseKey: failure.licenseKey,
        occurrenceCount: Number(failure.count),
        metadata: {
          errorMessage: failure.errorMessage,
          totalOccurrences: failure.count,
        },
      });
    }
  }

  return patterns;
}

/**
 * Store Detected Patterns in Database
 */
async function storeDetectedPatterns(
  patterns: DetectedPattern[]
): Promise<void> {
  for (const pattern of patterns) {
    // Check if pattern already exists
    const existing = await db
      .select()
      .from(failurePatterns)
      .where(eq(failurePatterns.patternId, pattern.patternId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing pattern
      await db
        .update(failurePatterns)
        .set({
          occurrenceCount: sql`${failurePatterns.occurrenceCount} + ${pattern.occurrenceCount}`,
          lastDetectedAt: new Date(),
          metadata: pattern.metadata,
        })
        .where(eq(failurePatterns.patternId, pattern.patternId));
    } else {
      // Insert new pattern
      const newPattern: NewFailurePattern = {
        patternId: pattern.patternId,
        licenseKey: pattern.licenseKey,
        patternType: pattern.patternType,
        description: pattern.description,
        severity: pattern.severity,
        occurrenceCount: pattern.occurrenceCount,
        metadata: pattern.metadata,
        status: "active",
      };

      await db.insert(failurePatterns).values(newPattern);
    }
  }
}

/**
 * Get Active Failure Patterns
 */
export async function getActiveFailurePatterns(licenseKey?: string) {
  const whereConditions = [eq(failurePatterns.status, "active")];

  if (licenseKey) {
    whereConditions.push(eq(failurePatterns.licenseKey, licenseKey));
  }

  return await db
    .select()
    .from(failurePatterns)
    .where(and(...whereConditions))
    .orderBy(desc(failurePatterns.lastDetectedAt));
}

/**
 * Resolve Failure Pattern
 */
export async function resolveFailurePattern(
  patternId: string,
  resolutionNotes: string
): Promise<void> {
  await db
    .update(failurePatterns)
    .set({
      status: "resolved",
      resolutionNotes,
    })
    .where(eq(failurePatterns.patternId, patternId));
}
