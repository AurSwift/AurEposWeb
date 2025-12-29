import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { customers, payments, subscriptions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    return NextResponse.json({
      billingHistory: billingHistory.map((item) => ({
        id: item.id,
        invoiceId: `INV-${item.id.substring(0, 8).toUpperCase()}`,
        date: item.createdAt,
        amount: parseFloat(item.amount),
        currency: item.currency,
        status: item.status === "completed" ? "Paid" : item.status,
        plan: item.subscription?.planId
          ? item.subscription.planId.charAt(0).toUpperCase() +
            item.subscription.planId.slice(1) +
            " Plan"
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
    console.error("Billing history error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch billing history",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

