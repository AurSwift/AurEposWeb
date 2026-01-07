import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { payments, subscriptions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/api/auth-helpers";
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";
import { successResponse, handleApiError } from "@/lib/api/response-helpers";
import { getPlanDisplayName } from "@/lib/stripe/plan-utils";

export async function GET(_request: NextRequest) {
  try {
    const session = await requireAuth();
    const customer = await getCustomerOrThrow(session.user.id);

    // Get all payments with subscription info
    const billingHistory = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        paymentType: payments.paymentType,
        invoiceUrl: payments.invoiceUrl,
        billingPeriodStart: payments.billingPeriodStart,
        billingPeriodEnd: payments.billingPeriodEnd,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
        subscription: {
          planId: subscriptions.planId,
          billingCycle: subscriptions.billingCycle,
        },
      })
      .from(payments)
      .leftJoin(subscriptions, eq(payments.subscriptionId, subscriptions.id))
      .where(eq(payments.customerId, customer.id))
      .orderBy(desc(payments.createdAt));

    return successResponse({
      billingHistory: billingHistory.map((item) => ({
        id: item.id,
        invoiceId: `INV-${item.id.substring(0, 8).toUpperCase()}`,
        date: item.createdAt,
        amount: parseFloat(item.amount),
        currency: item.currency,
        status: item.status === "completed" ? "Paid" : item.status,
        plan: item.subscription?.planId
          ? getPlanDisplayName(item.subscription.planId)
          : "N/A",
        period:
          item.billingPeriodStart && item.billingPeriodEnd
            ? `${new Date(item.billingPeriodStart).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })} - ${new Date(item.billingPeriodEnd).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}`
            : null,
        invoiceUrl: item.invoiceUrl,
        paidAt: item.paidAt,
      })),
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch billing history");
  }
}

