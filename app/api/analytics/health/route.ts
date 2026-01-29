/**
 * Analytics API - Health Score Endpoint
 * GET /api/analytics/health/:licenseKey - Get health score for specific license
 * GET /api/analytics/health - Get all unhealthy licenses
 * POST /api/analytics/health/calculate - Trigger health score calculation
 */

import { NextRequest, NextResponse } from "next/server";
import {
  calculateHealthScore,
  getHealthMetrics,
  getUnhealthyLicenses,
  calculateAllHealthScores,
} from "@/lib/analytics/health-scorer";

export const dynamic = "force-dynamic";

/**
 * GET - Get health score for license or all unhealthy licenses
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const licenseKey = searchParams.get("licenseKey");

    if (licenseKey) {
      // Get health metrics for specific license
      const metrics = await getHealthMetrics(licenseKey);

      if (!metrics) {
        return NextResponse.json(
          { error: "Health metrics not found. Run calculation first." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        metrics,
      });
    } else {
      // Get all unhealthy licenses
      const unhealthyLicenses = await getUnhealthyLicenses();

      return NextResponse.json({
        success: true,
        count: unhealthyLicenses.length,
        licenses: unhealthyLicenses,
      });
    }
  } catch (error) {
    console.error("Error fetching health metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch health metrics" },
      { status: 500 }
    );
  }
}

/**
 * POST - Calculate health score
 */
export async function POST(request: NextRequest) {
  try {
    const { licenseKey, calculateAll } = await request.json();

    if (calculateAll) {
      // Calculate health scores for all active licenses
      const results = await calculateAllHealthScores();

      return NextResponse.json({
        success: true,
        message: `Health scores calculated for ${results.length} licenses`,
        results,
      });
    } else if (licenseKey) {
      // Calculate for specific license
      const result = await calculateHealthScore(licenseKey);

      return NextResponse.json({
        success: true,
        result,
      });
    } else {
      return NextResponse.json(
        { error: "Either licenseKey or calculateAll is required" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error calculating health score:", error);
    return NextResponse.json(
      { error: "Failed to calculate health score" },
      { status: 500 }
    );
  }
}
