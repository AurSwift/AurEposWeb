/**
 * Health Check Endpoint
 *
 * Simple endpoint for desktop app to verify server connectivity.
 * Returns 200 OK if the server is up and running.
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
