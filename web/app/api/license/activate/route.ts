import { NextRequest, NextResponse } from "next/server";
import { activateLicense } from "@/lib/license/validator";

/**
 * POST /api/license/activate
 * Activate a license key for a specific machine/terminal
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { licenseKey, machineIdHash, terminalName, appVersion, location } = body;

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

    // Get client IP address
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ipAddress = forwardedFor?.split(",")[0] || realIp || "unknown";

    // Process activation
    const result = await activateLicense({
      licenseKey,
      machineIdHash,
      terminalName: terminalName || "Terminal",
      appVersion: appVersion || "unknown",
      ipAddress,
      location,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("License activation error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error during activation" },
      { status: 500 }
    );
  }
}
