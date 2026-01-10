/**
 * TEST ENDPOINT: Check SSE Connection Status
 *
 * This endpoint checks if a desktop app is connected to the SSE
 * endpoint for a given license key.
 *
 * Usage:
 * GET /api/test/sse-status?licenseKey=AURA-XXXX-XXXX-XXXX-XXXX
 */

import { NextRequest, NextResponse } from "next/server";
import { getSubscriberCount } from "@/lib/subscription-events/redis-publisher";
import { isRedisConfigured } from "@/lib/redis";

export async function GET(request: NextRequest) {
  try {
    const licenseKey = request.nextUrl.searchParams.get("licenseKey");

    if (!licenseKey) {
      return NextResponse.json(
        {
          error:
            "Missing licenseKey parameter. Usage: ?licenseKey=AURA-XXXX...",
        },
        { status: 400 }
      );
    }

    const normalizedKey = licenseKey.toUpperCase();
    const subscriberCount = getSubscriberCount(normalizedKey);
    const transport = isRedisConfigured() ? "Redis" : "in-memory";

    console.log("[TEST] Checking SSE status", {
      licenseKey: normalizedKey.substring(0, 15) + "...",
      subscribers: subscriberCount,
      transport,
    });

    return NextResponse.json({
      licenseKey: normalizedKey.substring(0, 15) + "...",
      subscribers: subscriberCount,
      isConnected: subscriberCount > 0,
      transport,
      status:
        subscriberCount === 0
          ? "No active connections"
          : subscriberCount === 1
          ? "1 active connection"
          : `${subscriberCount} active connections`,
      note:
        subscriberCount === 0
          ? "Desktop app is not connected to SSE. Check if app is running and license is activated."
          : "Desktop app is connected and will receive real-time events.",
    });
  } catch (error) {
    console.error("[TEST] Error checking SSE status:", error);
    return NextResponse.json(
      {
        error: "Failed to check SSE status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
