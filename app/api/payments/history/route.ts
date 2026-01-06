import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { payments, subscriptions } from "@/lib/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { requireAuth } from "@/lib/api/auth-helpers";
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";
import { successResponse, handleApiError } from "@/lib/api/response-helpers";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Get pagination parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const customer = await getCustomerOrThrow(session.user.id);

    // Get payment history
    const paymentHistory = await db
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
        stripePaymentId: payments.stripePaymentId,
        subscription: {
          planId: subscriptions.planId,
          billingCycle: subscriptions.billingCycle,
        },
      })
      .from(payments)
      .leftJoin(subscriptions, eq(payments.subscriptionId, subscriptions.id))
      .where(eq(payments.customerId, customer.id))
      .orderBy(desc(payments.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const countResult = await db
      .select({ count: count() })
      .from(payments)
      .where(eq(payments.customerId, customer.id));

    const totalCount = countResult[0]?.count ? Number(countResult[0].count) : 0;
    const totalPages = Math.ceil(totalCount / limit);

    return successResponse({
      payments: paymentHistory,
      pagination: {
        total: totalCount,
        page,
        pageSize: limit,
        totalPages,
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch payment history");
  }
}
