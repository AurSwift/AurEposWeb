import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { requireAuth } from "@/lib/api/auth-helpers";
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";
import {
  successResponse,
  handleApiError,
  ValidationError,
} from "@/lib/api/response-helpers";

export async function POST(_request: NextRequest) {
  try {
    const session = await requireAuth();
    const customer = await getCustomerOrThrow(session.user.id);

    if (!customer.stripeCustomerId) {
      throw new ValidationError("No Stripe customer found");
    }

    // Create portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customer.stripeCustomerId,
      return_url: `${process.env.NEXTAUTH_URL}/dashboard`,
    });

    return successResponse({ url: portalSession.url });
  } catch (error) {
    return handleApiError(error, "Failed to create portal session");
  }
}

