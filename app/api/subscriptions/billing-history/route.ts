import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { invoices, subscriptions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/api/auth-helpers";
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";
import { successResponse, handleApiError } from "@/lib/api/response-helpers";
import { getPlanDisplayName } from "@/lib/stripe/plan-utils";

export async function GET(_request: NextRequest) {
  try {
    const session = await requireAuth();
    const customer = await getCustomerOrThrow(session.user.id);

    // Get all invoices with subscription info
    // We use the invoices table as the source of truth for billing history
    const billingHistory = await db
      .select({
        id: invoices.id,
        stripeInvoiceId: invoices.stripeInvoiceId,
        number: invoices.number,
        total: invoices.total,
        currency: invoices.currency,
        status: invoices.status,
        hostedInvoiceUrl: invoices.hostedInvoiceUrl,
        invoicePdf: invoices.invoicePdf,
        periodStart: invoices.periodStart,
        periodEnd: invoices.periodEnd,
        paidAt: invoices.paidAt,
        createdAt: invoices.createdAt,
        description: invoices.description,
        subscription: {
          planId: subscriptions.planId,
          billingCycle: subscriptions.billingCycle,
        },
      })
      .from(invoices)
      .leftJoin(subscriptions, eq(invoices.subscriptionId, subscriptions.id))
      .where(eq(invoices.customerId, customer.id))
      .orderBy(desc(invoices.createdAt));

    return successResponse({
      billingHistory: billingHistory.map((item) => ({
        id: item.id,
        // Use the friendly invoice number if available, otherwise the Stripe ID
        invoiceId: item.number || item.stripeInvoiceId,
        date: item.createdAt,
        // Convert from cents to decimal currency unit
        amount: item.total ? item.total / 100 : 0,
        currency: item.currency,
        status: item.status.charAt(0).toUpperCase() + item.status.slice(1),
        plan: item.subscription?.planId
          ? getPlanDisplayName(item.subscription.planId)
          : item.description || "Subscription",
        period:
          item.periodStart && item.periodEnd
            ? `${new Date(item.periodStart).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })} - ${new Date(item.periodEnd).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}`
            : null,
        invoiceUrl: item.hostedInvoiceUrl || item.invoicePdf,
        paidAt: item.paidAt,
      })),
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch billing history");
  }
}

