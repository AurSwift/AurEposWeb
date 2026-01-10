import { requireAuth } from "@/lib/api/auth-helpers";
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";
import { successResponse, handleApiError } from "@/lib/api/response-helpers";
import { db } from "@/lib/db";
import { paymentMethods } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * GET /api/stripe/billing/payment-method
 * Fetches the customer's default payment method from database
 */
export async function GET() {
  try {
    const session = await requireAuth();
    const customer = await getCustomerOrThrow(session.user.id);

    // Fetch default payment method from database
    let [paymentMethod] = await db
      .select()
      .from(paymentMethods)
      .where(
        and(
          eq(paymentMethods.customerId, customer.id),
          eq(paymentMethods.isDefault, true),
          eq(paymentMethods.isActive, true)
        )
      )
      .limit(1);

    // If no default found, try to find ANY active payment method (fallback)
    if (!paymentMethod) {
      const [anyPaymentMethod] = await db
        .select()
        .from(paymentMethods)
        .where(
          and(
            eq(paymentMethods.customerId, customer.id),
            eq(paymentMethods.isActive, true)
          )
        )
        // Order by most recently created
        .orderBy(desc(paymentMethods.id)) 
        .limit(1);
      
      if (anyPaymentMethod) {
        paymentMethod = anyPaymentMethod;
      }
    }

    if (!paymentMethod) {
      return successResponse({ paymentMethod: null });
    }

    // Return safe payment method data (last 4 digits only)
    return successResponse({
      paymentMethod: {
        id: paymentMethod.stripePaymentMethodId,
        type: paymentMethod.type,
        brand: paymentMethod.brand,
        last4: paymentMethod.last4,
        expMonth: paymentMethod.expMonth,
        expYear: paymentMethod.expYear,
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch payment method");
  }
}

