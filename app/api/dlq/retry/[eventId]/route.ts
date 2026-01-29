/**
 * DLQ Retry API (Phase 4: Event Durability & Reliability)
 *
 * POST /api/dlq/retry/{eventId}
 */

import { NextRequest, NextResponse } from "next/server";
import { retryDLQEvent } from "@/lib/event-durability/dead-letter-queue";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    if (!eventId) {
      return NextResponse.json(
        { error: "Missing eventId parameter" },
        { status: 400 }
      );
    }

    const success = await retryDLQEvent(eventId);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to retry event" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Event ${eventId} re-queued for retry`,
    });
  } catch (error) {
    console.error("[DLQ Retry API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to retry event",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
