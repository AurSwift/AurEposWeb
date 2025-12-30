import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { subscriptions, customers, licenseKeys } from "@/lib/db/schema";
import { eq, and, or, desc } from "drizzle-orm";

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

    // Get active subscription with license keys
    const result = await db
      .select({
        subscription: subscriptions,
        licenseKey: licenseKeys,
      })
      .from(subscriptions)
      .leftJoin(
        licenseKeys,
        and(
          eq(subscriptions.id, licenseKeys.subscriptionId),
          eq(licenseKeys.isActive, true)
        )
      )
      .where(
        and(
          eq(subscriptions.customerId, customer.id),
          or(
            eq(subscriptions.status, "active"),
            eq(subscriptions.status, "trialing")
          )
        )
      )
      .orderBy(desc(subscriptions.createdAt))
      .limit(10); // Get up to 10 rows (1 subscription with multiple license keys)

    if (result.length === 0) {
      return NextResponse.json({ subscription: null });
    }

    // Group license keys by subscription
    const subscription = result[0].subscription;
    const licenseKeysArray = result
      .filter((r) => r.licenseKey !== null)
      .map((r) => r.licenseKey);

    return NextResponse.json({
      subscription: {
        ...subscription,
        licenseKeys: licenseKeysArray,
      },
    });
  } catch (error) {
    console.error("Subscription fetch error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch subscription",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
