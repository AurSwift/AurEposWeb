import { NextRequest, NextResponse } from "next/server";
import { processHeartbeat } from "@/lib/license/validator";
import {
  createRateLimitKey,
  checkRateLimit,
  LICENSE_RATE_LIMITS,
  addRateLimitHeaders,
} from "@/lib/rate-limit";

/**
 * POST /api/license/heartbeat
 * Process heartbeat from desktop app to maintain activation validity
 *
 * Rate limited: 12 requests per minute per license key
 * (Expected: 1/min, allows bursts for reconnection scenarios)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      licenseKey,
      machineIdHash,
      appVersion,
      sessionCount,
      transactionCount,
    } = body;

    // Validate required fields
    if (!licenseKey) {
      return NextResponse.json(
        { success: false, message: "License key is required" },
        { status: 400 }
      );
    }

    if (!machineIdHash) {
      return NextResponse.json(
        { success: false, message: "Machine ID is required" },
        { status: 400 }
      );
    }

    // Apply rate limiting per license key + machine combo
    const rateLimitKey = createRateLimitKey(
      "heartbeat",
      licenseKey,
      machineIdHash
    );
    const rateLimitResult = checkRateLimit(
      rateLimitKey,
      LICENSE_RATE_LIMITS.heartbeat
    );

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Heartbeat rate limit exceeded. Reduce heartbeat frequency.",
          retryAfter: rateLimitResult.retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rateLimitResult.retryAfter),
          },
        }
      );
    }

    // Process heartbeat
    const result = await processHeartbeat(licenseKey, machineIdHash, {
      appVersion,
      sessionCount,
      transactionCount,
    });

    const response = NextResponse.json(
      result.success
        ? result
        : { success: false, message: result.message, data: result.data },
      { status: result.success ? 200 : 400 }
    );

    addRateLimitHeaders(response.headers, "heartbeat", rateLimitResult);
    return response;
  } catch (error) {
    console.error("License heartbeat error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error during heartbeat" },
      { status: 500 }
    );
  }
}
