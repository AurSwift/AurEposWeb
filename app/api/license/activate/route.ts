import { NextRequest, NextResponse } from "next/server";
import { activateLicense } from "@/lib/license/validator";
import {
  applyRateLimit,
  getClientIP,
  addRateLimitHeaders,
} from "@/lib/rate-limit";

/**
 * POST /api/license/activate
 * Activate a license key for a specific machine/terminal
 *
 * Rate limited: 5 attempts per 15 minutes per IP
 */
export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const clientIP = getClientIP(request);

    // Apply rate limiting (strict for activation to prevent brute force)
    const rateLimit = applyRateLimit("activate", clientIP);
    if (rateLimit.blocked) {
      return rateLimit.response;
    }

    const body = await request.json();

    const { licenseKey, machineIdHash, terminalName, appVersion, location } =
      body;

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

    // Process activation
    const result = await activateLicense({
      licenseKey,
      machineIdHash,
      terminalName: terminalName || "Terminal",
      appVersion: appVersion || "unknown",
      ipAddress: clientIP,
      location,
    });

    // Build response with rate limit headers
    const response = NextResponse.json(
      result.success ? result : { success: false, message: result.message },
      { status: result.success ? 200 : 400 }
    );

    addRateLimitHeaders(response.headers, "activate", rateLimit.result);
    return response;
  } catch (error) {
    console.error("License activation error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error during activation" },
      { status: 500 }
    );
  }
}
