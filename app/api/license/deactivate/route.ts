import { NextRequest, NextResponse } from "next/server";
import { deactivateLicense, DeactivationResult } from "@/lib/license/validator";
import {
  applyRateLimit,
  getClientIP,
  addRateLimitHeaders,
} from "@/lib/rate-limit";

/**
 * POST /api/license/deactivate
 * Deactivate a license on a specific machine
 *
 * Rate limited: 3 attempts per hour per IP (strict to prevent abuse)
 */
export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const clientIP = getClientIP(request);

    // Apply strict rate limiting for deactivation
    const rateLimit = applyRateLimit("deactivate", clientIP);
    if (rateLimit.blocked) {
      return rateLimit.response;
    }

    const body = await request.json();
    const { licenseKey, machineIdHash } = body;

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

    // Process deactivation
    const result: DeactivationResult = await deactivateLicense(
      licenseKey,
      machineIdHash
    );

    const response = NextResponse.json(
      result.success
        ? {
            success: true,
            message: result.message,
            remainingDeactivations: result.remainingDeactivations,
          }
        : { success: false, message: result.message },
      { status: result.success ? 200 : 400 }
    );

    addRateLimitHeaders(response.headers, "deactivate", rateLimit.result);
    return response;
  } catch (error) {
    console.error("License deactivation error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error during deactivation" },
      { status: 500 }
    );
  }
}
