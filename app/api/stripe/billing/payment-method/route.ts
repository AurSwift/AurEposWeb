import { stripe } from "@/lib/stripe/client";
import { requireAuth } from "@/lib/api/auth-helpers";
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";
import { successResponse, handleApiError } from "@/lib/api/response-helpers";

/**
 * GET /api/stripe/billing/payment-method
 * Fetches the customer's default payment method from Stripe
 */
export async function GET() {
  try {
    const session = await requireAuth();
    const customer = await getCustomerOrThrow(session.user.id);

    if (!customer?.stripeCustomerId) {
      return successResponse({ paymentMethod: null });
    }

    // Fetch Stripe customer with default payment method
    const stripeCustomer = await stripe.customers.retrieve(
      customer.stripeCustomerId,
      {
        expand: ["invoice_settings.default_payment_method"],
      }
    );

    if (stripeCustomer.deleted) {
      return successResponse({ paymentMethod: null });
    }

    const defaultPaymentMethod =
      stripeCustomer.invoice_settings?.default_payment_method;

    if (!defaultPaymentMethod || typeof defaultPaymentMethod === "string") {
      return successResponse({ paymentMethod: null });
    }

    // Extract card details (safe to share - last 4 digits only)
    if (defaultPaymentMethod.type === "card" && defaultPaymentMethod.card) {
      return successResponse({
        paymentMethod: {
          id: defaultPaymentMethod.id,
          type: "card",
          brand: defaultPaymentMethod.card.brand,
          last4: defaultPaymentMethod.card.last4,
          expMonth: defaultPaymentMethod.card.exp_month,
          expYear: defaultPaymentMethod.card.exp_year,
        },
      });
    }

    return successResponse({ paymentMethod: null });
  } catch (error) {
    return handleApiError(error, "Failed to fetch payment method");
  }
}

