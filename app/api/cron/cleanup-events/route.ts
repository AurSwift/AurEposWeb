/**
 * Event Cleanup API
 *
 * GET /api/cron/cleanup-events - Trigger manual cleanup of expired events
 * GET /api/cron/cleanup-events?stats=true - Get cleanup statistics only
 *
 * Can be called by:
 * - Vercel Cron (vercel.json configuration)
 * - External cron services (cron-job.org)
 * - Manual testing/maintenance
 *
 * Security: In production, should be protected with cron secret or API key
 */

import { NextRequest, NextResponse } from "next/server";
import {
  cleanupExpiredEvents,
  getCleanupStats,
} from "@/lib/cron/cleanup-events";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const statsOnly = searchParams.get("stats") === "true";

    // Verify cron secret if in production
    if (process.env.NODE_ENV === "production") {
      const cronSecret = request.headers.get("x-cron-secret");
      if (cronSecret !== process.env.CRON_SECRET) {
        console.warn("[Cleanup API] Unauthorized access attempt");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    if (statsOnly) {
      // Return statistics only
      const stats = await getCleanupStats();
      console.log("[Cleanup API] Statistics requested:", stats);

      return NextResponse.json({
        success: true,
        stats,
      });
    }

    // Perform cleanup
    console.log("[Cleanup API] Starting cleanup...");
    const deletedCount = await cleanupExpiredEvents();

    // Get updated statistics
    const stats = await getCleanupStats();

    return NextResponse.json({
      success: true,
      deletedCount,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cleanup API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Cleanup failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
