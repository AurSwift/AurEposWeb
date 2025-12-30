import { NextResponse } from "next/server";
import { getPlans } from "@/lib/stripe/plans";
import type { Plan } from "@/lib/stripe/plans";

// Client-safe Plan type (without Stripe Price IDs and Product ID)
type ClientPlan = Omit<
  Plan,
  "stripePriceIdMonthly" | "stripePriceIdAnnual" | "stripeProductId"
>;

// Return plans fetched from Stripe (with caching)
export async function GET() {
  try {
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

    return NextResponse.json({
      plans: clientPlans,
    });
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
