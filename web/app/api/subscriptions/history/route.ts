import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { subscriptionChanges, customers } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get pagination parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
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

    // Get subscription change history
    const changes = await db
      .select()
      .from(subscriptionChanges)
      .where(eq(subscriptionChanges.customerId, customer.id))
      .orderBy(desc(subscriptionChanges.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [{ count }] = await db
      .select({ count: subscriptionChanges.id })
      .from(subscriptionChanges)
      .where(eq(subscriptionChanges.customerId, customer.id));

    const totalCount = typeof count === "number" ? count : 0;
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      changes,
      pagination: {
        total: totalCount,
        page,
        pageSize: limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Subscription history fetch error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch subscription history",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
