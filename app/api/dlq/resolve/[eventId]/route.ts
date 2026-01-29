/**
 * DLQ Resolve API (Phase 4: Event Durability & Reliability)
 *
 * POST /api/dlq/resolve/{eventId}
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveDLQEvent } from "@/lib/event-durability/dead-letter-queue";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const body = await request.json();
    const { resolvedBy, notes } = body;

    if (!eventId || !resolvedBy) {
      return NextResponse.json(
        { error: "Missing required fields: eventId, resolvedBy" },
        { status: 400 }
      );
    }

    const success = await resolveDLQEvent(eventId, resolvedBy, notes);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to resolve event" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Event ${eventId} marked as resolved`,
    });
  } catch (error) {
    console.error("[DLQ Resolve API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to resolve event",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
