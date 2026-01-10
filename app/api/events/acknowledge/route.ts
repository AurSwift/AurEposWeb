/**
 * Event Acknowledgment API (Phase 4: Event Durability & Reliability)
 *
 * POST /api/events/acknowledge
 *
 * Desktop clients call this endpoint after successfully processing an event.
 * This enables:
 * - Tracking which events were successfully processed
 * - Identifying events that need retry
 * - Monitoring desktop client health
 * - Dead letter queue population for failed events
 *
 * Request Body:
 * {
 *   eventId: string,
 *   licenseKey: string,
 *   machineIdHash: string,
 *   status: "success" | "failed" | "skipped",
 *   errorMessage?: string,
 *   processingTimeMs?: number
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eventAcknowledgments, subscriptionEvents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      eventId,
      licenseKey,
      machineIdHash,
      status = "success",
      errorMessage,
      processingTimeMs,
    } = body;

    // Validate required fields
    if (!eventId || !licenseKey) {
      return NextResponse.json(
        { error: "Missing required fields: eventId, licenseKey" },
        { status: 400 }
      );
    }

    // Validate status
    if (!["success", "failed", "skipped"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be: success, failed, or skipped" },
        { status: 400 }
      );
    }

    console.log(
      `[Event ACK] Received acknowledgment for ${eventId} from ${licenseKey.substring(
        0,
        15
      )}... - Status: ${status}`
    );

    // Check if event exists in subscription_events table
    const event = await db
      .select()
      .from(subscriptionEvents)
      .where(eq(subscriptionEvents.eventId, eventId))
      .limit(1);

    if (event.length === 0) {
      console.warn(
        `[Event ACK] Event ${eventId} not found in subscription_events table`
      );
      // Don't fail - event might be old and cleaned up
    }

    // Check if already acknowledged by this machine
    const existingAck = await db
      .select()
      .from(eventAcknowledgments)
      .where(
        and(
          eq(eventAcknowledgments.eventId, eventId),
          eq(eventAcknowledgments.machineIdHash, machineIdHash || "")
        )
      )
      .limit(1);

    if (existingAck.length > 0) {
      console.log(
        `[Event ACK] Event ${eventId} already acknowledged by this machine`
      );
      return NextResponse.json({
        success: true,
        message: "Event already acknowledged",
        acknowledgment: existingAck[0],
      });
    }

    // Insert acknowledgment
    const acknowledgment = await db
      .insert(eventAcknowledgments)
      .values({
        eventId,
        licenseKey,
        machineIdHash: machineIdHash || null,
        status,
        errorMessage: errorMessage || null,
        processingTimeMs: processingTimeMs || null,
      })
      .returning();

    console.log(
      `[Event ACK] ✅ Acknowledgment recorded: ${acknowledgment[0].id}`
    );

    // If status is "failed" and this is a critical event, trigger retry mechanism
    if (status === "failed") {
      console.warn(
        `[Event ACK] ⚠️ Event ${eventId} processing failed: ${errorMessage}`
      );
      // Retry mechanism will pick this up in background job
    }

    return NextResponse.json({
      success: true,
      acknowledgment: acknowledgment[0],
    });
  } catch (error) {
    console.error("[Event ACK] Error processing acknowledgment:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process acknowledgment",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/events/acknowledge?eventId={id}
 *
 * Get acknowledgment status for a specific event
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json(
        { error: "Missing eventId parameter" },
        { status: 400 }
      );
    }

    const acknowledgments = await db
      .select()
      .from(eventAcknowledgments)
      .where(eq(eventAcknowledgments.eventId, eventId));

    return NextResponse.json({
      success: true,
      eventId,
      acknowledgments,
      count: acknowledgments.length,
    });
  } catch (error) {
    console.error("[Event ACK] Error fetching acknowledgments:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch acknowledgments",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
