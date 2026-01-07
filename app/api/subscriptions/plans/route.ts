import { NextRequest, NextResponse } from "next/server";
import { getPlans, clearPlansCache } from "@/lib/stripe/plans";
import { applyRateLimit, addRateLimitHeaders, getClientIP } from "@/lib/rate-limit";
import type { Plan } from "@/lib/stripe/plans";

// Client-safe Plan type (without Stripe Price IDs and Product ID)
type ClientPlan = Omit<
  Plan,
  "stripePriceIdMonthly" | "stripePriceIdAnnual" | "stripeProductId"
>;

// Return plans fetched from Stripe (with caching)
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const clientIP = getClientIP(request);
  const rateLimit = applyRateLimit("plans", clientIP);

  if (rateLimit.blocked) {
    return rateLimit.response;
  }

  try {
    // Check for cache refresh header
    const forceRefresh = request.headers.get("x-force-refresh") === "true";
    if (forceRefresh) {
      clearPlansCache();
    }

    const plans = await getPlans();

    // Remove sensitive Stripe IDs for client-side
    const clientPlans: Record<string, ClientPlan> = {};
    Object.entries(plans).forEach(([planId, plan]) => {
      const {
        stripePriceIdMonthly: _,
        stripePriceIdAnnual: __,
        stripeProductId: ___,
        ...clientPlan
      } = plan;
      clientPlans[planId] = clientPlan;
    });

    const response = NextResponse.json({
      plans: clientPlans,
    });

    // Add rate limit headers
    addRateLimitHeaders(response.headers, "plans", rateLimit.result);

    return response;
  } catch (error) {
    console.error("Error fetching plans:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch plans",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

