/**
 * Terminal Broadcast API
 * POST /api/terminals/broadcast - Broadcast event to all terminals
 * POST /api/terminals/deactivate - Deactivate all terminals for license
 */

import { NextRequest, NextResponse } from "next/server";
import {
  broadcastToAllTerminals,
  deactivateAllTerminals,
} from "@/lib/terminal-coordination/coordination-system";

export const dynamic = "force-dynamic";

/**
 * POST - Broadcast event or deactivate all terminals
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, licenseKey, eventType, payload } = body;

    if (!licenseKey) {
      return NextResponse.json(
        { error: "licenseKey is required" },
        { status: 400 }
      );
    }

    if (action === "broadcast") {
      // Broadcast event to all terminals
      if (!eventType || !payload) {
        return NextResponse.json(
          { error: "eventType and payload are required for broadcast" },
          { status: 400 }
        );
      }

      await broadcastToAllTerminals(licenseKey, eventType, payload);

      return NextResponse.json({
        success: true,
        message: `Event broadcasted to all terminals`,
      });
    } else if (action === "deactivate") {
      // Deactivate all terminals
      await deactivateAllTerminals(licenseKey);

      return NextResponse.json({
        success: true,
        message: "All terminals deactivated",
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use: broadcast or deactivate" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error broadcasting to terminals:", error);
    return NextResponse.json(
      { error: "Failed to broadcast to terminals" },
      { status: 500 }
    );
  }
}
