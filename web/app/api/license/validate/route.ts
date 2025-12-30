import { NextRequest, NextResponse } from "next/server";
import { validateLicense } from "@/lib/license/validator";

/**
 * POST /api/license/validate
 * Validate a license key (optionally check if activated on specific machine)
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

    // Process validation
    const result = await validateLicense(licenseKey, machineIdHash);

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
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

    // Validate without machine check
    const result = await validateLicense(licenseKey);

    return NextResponse.json(result);
  } catch (error) {
    console.error("License validation error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error during validation" },
      { status: 500 }
    );
  }
}
