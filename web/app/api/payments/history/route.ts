import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { payments, customers, subscriptions } from "@/lib/db/schema";
import { eq, desc, count, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get pagination parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Get customer
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, session.user.id))
      .limit(1);

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

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

    return NextResponse.json({
      payments: paymentHistory,
      pagination: {
        total: totalCount,
        page,
        pageSize: limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Payment history error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch payment history",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
