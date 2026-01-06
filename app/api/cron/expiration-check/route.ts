import { NextRequest, NextResponse } from "next/server";
import { runAllExpirationChecks } from "@/lib/cron/trial-expiration";

/**
 * Cron endpoint for trial and subscription expiration checks
 *
 * This endpoint should be called by a cron service (Vercel Cron, AWS Lambda, etc.)
 *
 * Security: Protect this endpoint with:
 * 1. Vercel Cron Secret (Authorization: Bearer <CRON_SECRET>)
 * 2. IP whitelist
 * 3. API key
 *
 * Recommended Schedule: Every 6-12 hours
 * - 0 star-slash-6 star star star (every 6 hours)
 * - 0 0,12 star star star (at midnight and noon)
 */
export async function GET(request: NextRequest) {
  try {
    // Security check - verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn("[CRON API] Unauthorized access attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[CRON API] Starting expiration checks...");

    const results = await runAllExpirationChecks();

    return NextResponse.json({
      success: true,
      message: "Expiration checks completed successfully",
      results,
    });
  } catch (error) {
    console.error("[CRON API] Expiration check failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Expiration check failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Allow POST as well for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
