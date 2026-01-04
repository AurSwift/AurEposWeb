import { NextRequest, NextResponse } from "next/server";
import { validateLicense } from "@/lib/license/validator";
import {
  applyRateLimit,
  getClientIP,
  addRateLimitHeaders,
  createRateLimitKey,
  checkRateLimit,
  LICENSE_RATE_LIMITS,
} from "@/lib/rate-limit";

/**
 * POST /api/license/validate
 * Validate a license key (optionally check if activated on specific machine)
 *
 * Rate limited: 30 requests per minute per license key
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { licenseKey, machineIdHash } = body;

    // Validate required fields
    if (!licenseKey) {
      return NextResponse.json(
        { success: false, message: "License key is required" },
        { status: 400 }
      );
    }

    // Apply rate limiting per license key (more permissive than activation)
    const rateLimitKey = createRateLimitKey("validate", licenseKey);
    const rateLimitResult = checkRateLimit(
      rateLimitKey,
      LICENSE_RATE_LIMITS.validate
    );

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Too many validation requests. Please try again later.",
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

    // Process validation
    const result = await validateLicense(licenseKey, machineIdHash);

    const response = NextResponse.json(
      result.success ? result : { success: false, message: result.message },
      { status: result.success ? 200 : 400 }
    );

    addRateLimitHeaders(response.headers, "validate", rateLimitResult);
    return response;
  } catch (error) {
    console.error("License validation error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error during validation" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/license/validate?licenseKey=xxx
 * Quick validation check (format only)
 *
 * Rate limited: 30 requests per minute per license key
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const licenseKey = searchParams.get("licenseKey");

    if (!licenseKey) {
      return NextResponse.json(
        { success: false, message: "License key is required" },
        { status: 400 }
      );
    }

    // Apply rate limiting per license key
    const rateLimitKey = createRateLimitKey("validate", licenseKey);
    const rateLimitResult = checkRateLimit(
      rateLimitKey,
      LICENSE_RATE_LIMITS.validate
    );

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Too many validation requests. Please try again later.",
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

    // Validate without machine check
    const result = await validateLicense(licenseKey);

    const response = NextResponse.json(result);
    addRateLimitHeaders(response.headers, "validate", rateLimitResult);
    return response;
  } catch (error) {
    console.error("License validation error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error during validation" },
      { status: 500 }
    );
  }
}
