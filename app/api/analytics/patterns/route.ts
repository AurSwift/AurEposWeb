/**
 * Analytics API - Failure Patterns Endpoint
 * GET /api/analytics/patterns - Get active failure patterns
 * POST /api/analytics/patterns/analyze - Analyze and detect new patterns
 * PATCH /api/analytics/patterns/:patternId/resolve - Resolve a pattern
 */

import { NextRequest, NextResponse } from "next/server";
import {
  analyzeFailurePatterns,
  getActiveFailurePatterns,
  resolveFailurePattern,
} from "@/lib/analytics/failure-pattern-analyzer";

export const dynamic = "force-dynamic";

/**
 * GET - Get active failure patterns
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const licenseKey = searchParams.get("licenseKey") || undefined;

    const patterns = await getActiveFailurePatterns(licenseKey);

    return NextResponse.json({
      success: true,
      count: patterns.length,
      patterns,
    });
  } catch (error) {
    console.error("Error fetching failure patterns:", error);
    return NextResponse.json(
      { error: "Failed to fetch failure patterns" },
      { status: 500 }
    );
  }
}

/**
 * POST - Analyze and detect failure patterns
 */
export async function POST(request: NextRequest) {
  try {
    const { licenseKey, timeWindowHours } = await request.json();

    const patterns = await analyzeFailurePatterns(
      licenseKey,
      timeWindowHours || 24
    );

    return NextResponse.json({
      success: true,
      message: `Detected ${patterns.length} failure patterns`,
      patterns,
    });
  } catch (error) {
    console.error("Error analyzing failure patterns:", error);
    return NextResponse.json(
      { error: "Failed to analyze failure patterns" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Resolve a failure pattern
 */
export async function PATCH(request: NextRequest) {
  try {
    const { patternId, resolutionNotes } = await request.json();

    if (!patternId || !resolutionNotes) {
      return NextResponse.json(
        { error: "patternId and resolutionNotes are required" },
        { status: 400 }
      );
    }

    await resolveFailurePattern(patternId, resolutionNotes);

    return NextResponse.json({
      success: true,
      message: "Pattern resolved successfully",
    });
  } catch (error) {
    console.error("Error resolving failure pattern:", error);
    return NextResponse.json(
      { error: "Failed to resolve failure pattern" },
      { status: 500 }
    );
  }
}
