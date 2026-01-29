/**
 * Cron Job - Health Monitoring
 * Runs every hour to check system health and trigger alerts
 */

import { NextRequest, NextResponse } from "next/server";
import { runHealthMonitoring } from "@/lib/monitoring/health-monitor";
import { isAlertingEnabled } from "@/lib/monitoring/alert-config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAlertingEnabled()) {
      return NextResponse.json({
        success: true,
        message: "Alerting not configured - skipping health monitoring",
        alertingEnabled: false,
      });
    }

    const startTime = Date.now();

    // Run health monitoring
    const results = await runHealthMonitoring();

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: `Health monitoring completed. ${results.totalAlerts} alerts triggered.`,
      duration: `${duration}ms`,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health monitoring cron error:", error);
    return NextResponse.json(
      {
        error: "Health monitoring failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
