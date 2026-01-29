/**
 * Monitoring API - Health Checks & Alerts
 * GET /api/monitoring/health - Run health checks and trigger alerts
 * GET /api/monitoring/status - Get current system status
 */

import { NextRequest, NextResponse } from "next/server";
import { runHealthMonitoring } from "@/lib/monitoring/health-monitor";
import { isAlertingEnabled } from "@/lib/monitoring/alert-config";

export const dynamic = "force-dynamic";

/**
 * GET - Run health monitoring checks
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "check";

    if (action === "status") {
      // Return alerting status
      return NextResponse.json({
        success: true,
        alerting: {
          enabled: isAlertingEnabled(),
          webhookConfigured: !!process.env.ALERT_WEBHOOK_URL,
          slackConfigured: !!process.env.SLACK_WEBHOOK_URL,
          discordConfigured: !!process.env.DISCORD_WEBHOOK_URL,
          emailConfigured: !!process.env.ALERT_EMAIL_TO,
        },
      });
    }

    // Run health monitoring
    const results = await runHealthMonitoring();

    return NextResponse.json({
      success: true,
      message: `Health monitoring completed. ${results.totalAlerts} alerts triggered.`,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health monitoring error:", error);
    return NextResponse.json(
      {
        error: "Health monitoring failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Manually trigger specific alert
 */
export async function POST(request: NextRequest) {
  try {
    const { type, title, message, severity, metadata, licenseKey } =
      await request.json();

    if (!type || !title || !message || !severity) {
      return NextResponse.json(
        { error: "type, title, message, and severity are required" },
        { status: 400 }
      );
    }

    const { sendAlert } = await import("@/lib/monitoring/alert-manager");

    await sendAlert(type, severity, title, message, metadata || {}, licenseKey);

    return NextResponse.json({
      success: true,
      message: "Alert sent successfully",
    });
  } catch (error) {
    console.error("Alert sending error:", error);
    return NextResponse.json(
      {
        error: "Failed to send alert",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
