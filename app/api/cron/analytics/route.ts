/**
 * Cron Job - Analytics Aggregation
 * Runs every hour to:
 * 1. Aggregate performance metrics
 * 2. Analyze failure patterns
 * 3. Calculate health scores
 */

import { NextRequest, NextResponse } from "next/server";
import { aggregatePerformanceMetrics } from "@/lib/analytics/performance-trending";
import { analyzeFailurePatterns } from "@/lib/analytics/failure-pattern-analyzer";
import { calculateAllHealthScores } from "@/lib/analytics/health-scorer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startTime = Date.now();
    const results = {
      performanceMetrics: { success: false, error: null as string | null },
      failurePatterns: {
        success: false,
        count: 0,
        error: null as string | null,
      },
      healthScores: { success: false, count: 0, error: null as string | null },
    };

    // 1. Aggregate performance metrics for the previous hour
    try {
      const previousHour = new Date();
      previousHour.setHours(previousHour.getHours() - 1);
      await aggregatePerformanceMetrics(undefined, previousHour);
      results.performanceMetrics.success = true;
    } catch (error) {
      results.performanceMetrics.error =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error aggregating performance metrics:", error);
    }

    // 2. Analyze failure patterns (last 24 hours)
    try {
      const patterns = await analyzeFailurePatterns(undefined, 24);
      results.failurePatterns.success = true;
      results.failurePatterns.count = patterns.length;
    } catch (error) {
      results.failurePatterns.error =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error analyzing failure patterns:", error);
    }

    // 3. Calculate health scores for all active licenses
    try {
      const healthResults = await calculateAllHealthScores();
      results.healthScores.success = true;
      results.healthScores.count = healthResults.length;
    } catch (error) {
      results.healthScores.error =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error calculating health scores:", error);
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: "Analytics aggregation completed",
      duration: `${duration}ms`,
      results,
    });
  } catch (error) {
    console.error("Analytics aggregation cron error:", error);
    return NextResponse.json(
      {
        error: "Analytics aggregation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
