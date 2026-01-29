/**
 * Analytics API - Performance Trends Endpoint
 * GET /api/analytics/trends - Get performance trend data
 * GET /api/analytics/trends/summary - Get performance summary
 * GET /api/analytics/trends/predict - Get performance predictions
 * POST /api/analytics/trends/aggregate - Trigger metrics aggregation
 */

import { NextRequest, NextResponse } from "next/server";
import {
  aggregatePerformanceMetrics,
  getPerformanceTrend,
  getPerformanceSummary,
  predictPerformance,
} from "@/lib/analytics/performance-trending";

export const dynamic = "force-dynamic";

/**
 * GET - Get performance trends or summary or predictions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const licenseKey = searchParams.get("licenseKey");
    const type = searchParams.get("type") || "trend"; // trend, summary, predict
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const hoursAhead = parseInt(searchParams.get("hoursAhead") || "24");

    // Default to last 24 hours
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const licenseKeyOrNull = licenseKey === "system" ? null : licenseKey;

    if (type === "predict") {
      // Get predictions
      const predictions = await predictPerformance(
        licenseKeyOrNull,
        hoursAhead
      );

      return NextResponse.json({
        success: true,
        predictions,
      });
    } else if (type === "summary") {
      // Get summary
      const summary = await getPerformanceSummary(licenseKeyOrNull, start, end);

      return NextResponse.json({
        success: true,
        summary,
      });
    } else {
      // Get trend data
      const trend = await getPerformanceTrend(licenseKeyOrNull, start, end);

      return NextResponse.json({
        success: true,
        count: trend.length,
        trend,
      });
    }
  } catch (error) {
    console.error("Error fetching performance trends:", error);
    return NextResponse.json(
      { error: "Failed to fetch performance trends" },
      { status: 500 }
    );
  }
}

/**
 * POST - Aggregate performance metrics for specific hour
 */
export async function POST(request: NextRequest) {
  try {
    const { licenseKey, timestamp } = await request.json();

    const targetTimestamp = timestamp ? new Date(timestamp) : undefined;

    await aggregatePerformanceMetrics(licenseKey, targetTimestamp);

    return NextResponse.json({
      success: true,
      message: "Performance metrics aggregated successfully",
    });
  } catch (error) {
    console.error("Error aggregating performance metrics:", error);
    return NextResponse.json(
      { error: "Failed to aggregate performance metrics" },
      { status: 500 }
    );
  }
}
