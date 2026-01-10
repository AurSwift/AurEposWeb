/**
 * Cron Job - Detect Stale Terminal Sessions
 * Runs every 5 minutes to detect and disconnect stale sessions
 */

import { NextRequest, NextResponse } from "next/server";
import { detectStaleSessions } from "@/lib/terminal-coordination/coordination-system";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await detectStaleSessions();

    return NextResponse.json({
      success: true,
      message: "Stale sessions detected and disconnected",
    });
  } catch (error) {
    console.error("Stale session detection error:", error);
    return NextResponse.json(
      {
        error: "Stale session detection failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
