/**
 * TEST ENDPOINT: Manually Trigger License Revoked Event
 *
 * This endpoint allows testing SSE event delivery by manually
 * triggering a license_revoked event for debugging purposes.
 *
 * Usage:
 * POST /api/test/trigger-revoke
 * Body: { "licenseKey": "AURA-XXXX-XXXX-XXXX-XXXX" }
 */

import { NextRequest, NextResponse } from "next/server";
import { publishLicenseRevoked } from "@/lib/subscription-events/publisher";
import { getSubscriberCount } from "@/lib/subscription-events/redis-publisher";

export async function POST(request: NextRequest) {
  try {
    const { licenseKey, reason } = await request.json();

    if (!licenseKey) {
      return NextResponse.json(
        { error: "Missing licenseKey parameter" },
        { status: 400 }
      );
    }

    const normalizedKey = licenseKey.toUpperCase();

    // Check how many subscribers are listening
    const subscriberCount = getSubscriberCount(normalizedKey);

    console.log("[TEST] Triggering license_revoked event", {
      licenseKey: normalizedKey.substring(0, 15) + "...",
      subscribers: subscriberCount,
      reason: reason || "Manual test trigger",
    });

    // Publish the event
    publishLicenseRevoked(normalizedKey, {
      reason: reason || "Manual test trigger - debugging SSE delivery",
    });

    return NextResponse.json({
      success: true,
      message: "license_revoked event published",
      licenseKey: normalizedKey.substring(0, 15) + "...",
      subscribers: subscriberCount,
      note:
        subscriberCount === 0
          ? "Warning: No subscribers connected for this license key"
          : `Event sent to ${subscriberCount} subscriber(s)`,
    });
  } catch (error) {
    console.error("[TEST] Error triggering event:", error);
    return NextResponse.json(
      {
        error: "Failed to trigger event",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
