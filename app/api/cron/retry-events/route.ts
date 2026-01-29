/**
 * Event Retry Cron Job API (Phase 4: Event Durability & Reliability)
 *
 * GET /api/cron/retry-events
 *
 * Triggers the event retry mechanism
 * Should be called every 5 minutes by Vercel Cron or external scheduler
 */

import { NextRequest, NextResponse } from "next/server";
import {
  processEventRetries,
  getRetryStats,
} from "@/lib/event-durability/retry-mechanism";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const statsOnly = searchParams.get("stats") === "true";

    // Verify cron secret if in production
    if (process.env.NODE_ENV === "production") {
      const cronSecret = request.headers.get("x-cron-secret");
      if (cronSecret !== process.env.CRON_SECRET) {
        console.warn("[Retry Cron] Unauthorized access attempt");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    if (statsOnly) {
      const stats = await getRetryStats();
      return NextResponse.json({
        success: true,
        stats,
      });
    }

    // Process retries
    console.log("[Retry Cron] Starting event retry process...");
    const results = await processEventRetries();

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Retry Cron] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Retry process failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
