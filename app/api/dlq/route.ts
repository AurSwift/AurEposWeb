/**
 * Dead Letter Queue API (Phase 4: Event Durability & Reliability)
 *
 * GET /api/dlq - List dead letter queue items
 * GET /api/dlq/stats - Get DLQ statistics
 * POST /api/dlq/retry/{eventId} - Retry a specific event
 * POST /api/dlq/resolve/{eventId} - Mark event as resolved
 * POST /api/dlq/abandon/{eventId} - Mark event as abandoned
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deadLetterQueue } from "@/lib/db/schema";
import { getDLQStats } from "@/lib/event-durability/dead-letter-queue";
import { eq, desc } from "drizzle-orm";

/**
 * GET /api/dlq?status={status}&limit={limit}&offset={offset}
 * List DLQ items with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const statsOnly = searchParams.get("stats") === "true";

    // Return stats only if requested
    if (statsOnly) {
      const stats = await getDLQStats();
      return NextResponse.json({
        success: true,
        stats,
      });
    }

    // Build query
    let query = db.select().from(deadLetterQueue);

    if (status) {
      query = query.where(eq(deadLetterQueue.status, status)) as typeof query;
    }

    const items = await query
      .orderBy(desc(deadLetterQueue.failedAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db.$count(deadLetterQueue);

    return NextResponse.json({
      success: true,
      items,
      count: items.length,
      total: totalResult,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[DLQ API] Error fetching DLQ items:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch DLQ items",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
