/**
 * Terminal Sessions API
 * POST /api/terminal-sessions/register - Register a new terminal session
 * POST /api/terminal-sessions/heartbeat - Update terminal heartbeat
 * POST /api/terminal-sessions/disconnect - Disconnect terminal
 * GET /api/terminal-sessions - Get terminals for license
 */

import { NextRequest, NextResponse } from "next/server";
import {
  registerTerminalSession,
  updateTerminalHeartbeat,
  disconnectTerminalSession,
  getActiveTerminals,
  getAllTerminals,
  getTerminalStats,
} from "@/lib/terminal-coordination/coordination-system";

export const dynamic = "force-dynamic";

/**
 * GET - Get terminals for license
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const licenseKey = searchParams.get("licenseKey");
    const includeInactive = searchParams.get("includeInactive") === "true";
    const statsOnly = searchParams.get("stats") === "true";

    if (statsOnly) {
      // Return statistics
      const stats = await getTerminalStats(licenseKey || undefined);
      return NextResponse.json({
        success: true,
        stats,
      });
    }

    if (!licenseKey) {
      return NextResponse.json(
        { error: "licenseKey is required" },
        { status: 400 }
      );
    }

    const terminals = includeInactive
      ? await getAllTerminals(licenseKey)
      : await getActiveTerminals(licenseKey);

    return NextResponse.json({
      success: true,
      count: terminals.length,
      terminals,
    });
  } catch (error) {
    console.error("Error fetching terminals:", error);
    return NextResponse.json(
      { error: "Failed to fetch terminals" },
      { status: 500 }
    );
  }
}

/**
 * POST - Register terminal, heartbeat, or disconnect
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, licenseKey, machineIdHash, terminalInfo } = body;

    if (!licenseKey || !machineIdHash) {
      return NextResponse.json(
        { error: "licenseKey and machineIdHash are required" },
        { status: 400 }
      );
    }

    if (action === "register") {
      // Register new terminal session
      const sessionId = await registerTerminalSession(licenseKey, {
        machineIdHash,
        ...terminalInfo,
      });

      return NextResponse.json({
        success: true,
        message: "Terminal session registered",
        sessionId,
      });
    } else if (action === "heartbeat") {
      // Update heartbeat
      await updateTerminalHeartbeat(licenseKey, machineIdHash);

      return NextResponse.json({
        success: true,
        message: "Heartbeat updated",
      });
    } else if (action === "disconnect") {
      // Disconnect terminal
      await disconnectTerminalSession(licenseKey, machineIdHash);

      return NextResponse.json({
        success: true,
        message: "Terminal disconnected",
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use: register, heartbeat, or disconnect" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error managing terminal session:", error);
    return NextResponse.json(
      { error: "Failed to manage terminal session" },
      { status: 500 }
    );
  }
}
