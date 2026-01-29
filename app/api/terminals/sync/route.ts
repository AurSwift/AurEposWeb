/**
 * Terminal State Sync API
 * POST /api/terminals/sync - Initiate state synchronization
 * POST /api/terminals/sync/ack - Acknowledge state sync
 * GET /api/terminals/sync/:syncId - Get sync status
 */

import { NextRequest, NextResponse } from "next/server";
import {
  synchronizeTerminalState,
  acknowledgeStateSync,
} from "@/lib/terminal-coordination/coordination-system";
import { db } from "@/lib/db";
import { terminalStateSync } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET - Get sync status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const syncId = searchParams.get("syncId");

    if (!syncId) {
      return NextResponse.json(
        { error: "syncId is required" },
        { status: 400 }
      );
    }

    const sync = await db
      .select()
      .from(terminalStateSync)
      .where(eq(terminalStateSync.id, syncId))
      .limit(1);

    if (sync.length === 0) {
      return NextResponse.json({ error: "Sync not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      sync: sync[0],
    });
  } catch (error) {
    console.error("Error fetching sync status:", error);
    return NextResponse.json(
      { error: "Failed to fetch sync status" },
      { status: 500 }
    );
  }
}

/**
 * POST - Initiate sync or acknowledge
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      licenseKey,
      syncType,
      sourceMachineIdHash,
      payload,
      targetMachineIdHashes,
      syncId,
      machineIdHash,
    } = body;

    if (action === "initiate") {
      // Initiate state synchronization
      if (!licenseKey || !syncType || !payload) {
        return NextResponse.json(
          { error: "licenseKey, syncType, and payload are required" },
          { status: 400 }
        );
      }

      const newSyncId = await synchronizeTerminalState(
        licenseKey,
        syncType,
        sourceMachineIdHash || null,
        payload,
        targetMachineIdHashes
      );

      return NextResponse.json({
        success: true,
        message: "State synchronization initiated",
        syncId: newSyncId,
      });
    } else if (action === "acknowledge") {
      // Acknowledge state sync
      if (!syncId || !machineIdHash) {
        return NextResponse.json(
          { error: "syncId and machineIdHash are required" },
          { status: 400 }
        );
      }

      await acknowledgeStateSync(syncId, machineIdHash);

      return NextResponse.json({
        success: true,
        message: "State sync acknowledged",
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use: initiate or acknowledge" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error managing state sync:", error);
    return NextResponse.json(
      { error: "Failed to manage state sync" },
      { status: 500 }
    );
  }
}
