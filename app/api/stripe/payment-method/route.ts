import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { stripe } from "@/lib/stripe/client";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/stripe/payment-method
 * Fetches the customer's default payment method from Stripe
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get customer record
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, session.user.id))
      .limit(1);

    if (!customer?.stripeCustomerId) {
      return NextResponse.json({ paymentMethod: null });
    }

    // Fetch Stripe customer with default payment method
    const stripeCustomer = await stripe.customers.retrieve(
      customer.stripeCustomerId,
      {
        expand: ["invoice_settings.default_payment_method"],
      }
    );

    if (stripeCustomer.deleted) {
      return NextResponse.json({ paymentMethod: null });
    }

    const defaultPaymentMethod =
      stripeCustomer.invoice_settings?.default_payment_method;

    if (!defaultPaymentMethod || typeof defaultPaymentMethod === "string") {
      return NextResponse.json({ paymentMethod: null });
    }

    // Extract card details (safe to share - last 4 digits only)
    if (defaultPaymentMethod.type === "card" && defaultPaymentMethod.card) {
      return NextResponse.json({
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

    return NextResponse.json({ paymentMethod: null });
  } catch (error) {
    console.error("Payment method fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment method" },
      { status: 500 }
    );
  }
}
