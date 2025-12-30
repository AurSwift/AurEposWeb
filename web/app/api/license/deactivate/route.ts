import { NextRequest, NextResponse } from "next/server";
import { deactivateLicense } from "@/lib/license/validator";

/**
 * POST /api/license/deactivate
 * Deactivate a license on a specific machine
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

    if (!machineIdHash) {
      return NextResponse.json(
        { success: false, message: "Machine ID is required" },
        { status: 400 }
      );
    }

    // Process deactivation
    const result = await deactivateLicense(licenseKey, machineIdHash);

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("License deactivation error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error during deactivation" },
      { status: 500 }
    );
  }
}
