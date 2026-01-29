import { requireAuth } from "@/lib/api/auth-helpers";
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";
import { successResponse, handleApiError } from "@/lib/api/response-helpers";
import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * GET /api/invoices/history
 * Fetches the customer's invoice history from database
 */
export async function GET() {
  try {
    const session = await requireAuth();
    const customer = await getCustomerOrThrow(session.user.id);

    // Fetch invoices for this customer, most recent first
    const invoiceList = await db
      .select()
      .from(invoices)
      .where(eq(invoices.customerId, customer.id))
      .orderBy(desc(invoices.createdAt))
      .limit(50);

    return successResponse({ invoices: invoiceList });
  } catch (error) {
    return handleApiError(error, "Failed to fetch invoices");
  }
}

