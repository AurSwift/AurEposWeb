/**
 * Health Check Endpoint
 *
 * Simple endpoint for desktop app to verify server connectivity.
 * Returns 200 OK if the server is up and running.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest) {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}

export async function HEAD(_request: NextRequest) {
  return new NextResponse(null, { status: 200 });
}
