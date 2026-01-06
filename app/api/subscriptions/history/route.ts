import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { subscriptionChanges } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/api/auth-helpers";
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";
import { successResponse, handleApiError } from "@/lib/api/response-helpers";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Get pagination parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const customer = await getCustomerOrThrow(session.user.id);

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

    return successResponse({
      changes,
      pagination: {
        total: totalCount,
        page,
        pageSize: limit,
        totalPages,
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch subscription history");
  }
}
