/**
 * Missed Events API
 *
 * GET /api/events/{licenseKey}/missed?since={timestamp}
 *
 * Returns subscription events that occurred after the given timestamp.
 * Used by desktop clients to fetch events missed during disconnections.
 *
 * Query Parameters:
 * - since: ISO 8601 timestamp (e.g., "2025-01-15T10:30:00.000Z")
 *
 * Response:
 * {
 *   events: SubscriptionEvent[],
 *   count: number,
 *   hasMore: boolean (true if more than 100 events, limited to prevent DOS)
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subscriptionEvents } from "@/lib/db/schema";
import { and, eq, gt, desc } from "drizzle-orm";

const MAX_EVENTS = 100;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ licenseKey: string }> }
) {
  try {
    const { licenseKey } = await params;
    const searchParams = request.nextUrl.searchParams;
    const sinceParam = searchParams.get("since");

    // Validate license key
    if (!licenseKey || typeof licenseKey !== "string") {
      return NextResponse.json(
        { error: "Invalid license key" },
        { status: 400 }
      );
    }

    // Validate timestamp parameter
    if (!sinceParam) {
      return NextResponse.json(
        { error: "Missing 'since' query parameter" },
        { status: 400 }
      );
    }

    const sinceDate = new Date(sinceParam);
    if (isNaN(sinceDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid 'since' timestamp format. Use ISO 8601." },
        { status: 400 }
      );
    }

    console.log(
      `[Missed Events API] Fetching events for ${licenseKey} since ${sinceDate.toISOString()}`
    );

    // Query database for events after the given timestamp
    const results = await db
      .select()
      .from(subscriptionEvents)
      .where(
        and(
          eq(subscriptionEvents.licenseKey, licenseKey),
          gt(subscriptionEvents.createdAt, sinceDate)
        )
      )
      .orderBy(desc(subscriptionEvents.createdAt))
      .limit(MAX_EVENTS + 1); // Fetch one extra to detect if there are more

    const hasMore = results.length > MAX_EVENTS;
    const events = results.slice(0, MAX_EVENTS);

    // Transform database records to SubscriptionEvent format
    const formattedEvents = events.map((record) => ({
      id: record.eventId,
      type: record.eventType,
      timestamp: record.createdAt.toISOString(),
      licenseKey: record.licenseKey,
      data: record.payload,
    }));

    console.log(
      `[Missed Events API] ✅ Returning ${formattedEvents.length} events (hasMore: ${hasMore})`
    );

    return NextResponse.json({
      events: formattedEvents,
      count: formattedEvents.length,
      hasMore,
    });
  } catch (error) {
    console.error("[Missed Events API] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
