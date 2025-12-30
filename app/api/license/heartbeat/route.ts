import { NextRequest, NextResponse } from "next/server";
import { processHeartbeat } from "@/lib/license/validator";

/**
 * POST /api/license/heartbeat
 * Process heartbeat from desktop app to maintain activation validity
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { licenseKey, machineIdHash, appVersion, sessionCount, transactionCount } =
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

    // Process heartbeat
    const result = await processHeartbeat(licenseKey, machineIdHash, {
      appVersion,
      sessionCount,
      transactionCount,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message, data: result.data },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("License heartbeat error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error during heartbeat" },
      { status: 500 }
    );
  }
}
