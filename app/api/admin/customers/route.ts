import { NextRequest, NextResponse } from "next/server";
import { requireInternalUser } from "@/lib/api/auth-helpers";
import { handleApiError } from "@/lib/api/response-helpers";
import { db } from "@/lib/db";
import { customers, users, subscriptions } from "@/lib/db/schema";
import { eq, desc, like, or } from "drizzle-orm";

/**
 * GET /api/admin/customers
 * List all customers (internal users only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireInternalUser();

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = db
      .select({
        id: customers.id,
        email: customers.email,
        companyName: customers.companyName,
        status: customers.status,
        createdAt: customers.createdAt,
        stripeCustomerId: customers.stripeCustomerId,
        userName: users.name,
        userEmail: users.email,
        emailVerified: users.emailVerified,
      })
      .from(customers)
      .leftJoin(users, eq(customers.userId, users.id))
      .orderBy(desc(customers.createdAt))
      .limit(limit)
      .offset(offset);

    // Add search filter if provided
    if (search) {
      query = query.where(
        or(
          like(customers.email, `%${search}%`),
          like(customers.companyName, `%${search}%`)
        )
      ) as typeof query;
    }

    const results = await query;

    return NextResponse.json({
      success: true,
      customers: results,
      pagination: {
        limit,
        offset,
        total: results.length,
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch customers");
  }
}

