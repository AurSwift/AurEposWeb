import { NextRequest, NextResponse } from "next/server";
import { requireInternalUser } from "@/lib/api/auth-helpers";
import { handleApiError } from "@/lib/api/response-helpers";
import { db } from "@/lib/db";
import { customers, subscriptions, supportTickets, licenseKeys, payments } from "@/lib/db/schema";
import { sql, eq, gte } from "drizzle-orm";

/**
 * GET /api/admin/stats
 * Get admin dashboard statistics
 */
export async function GET(request: NextRequest) {
  try {
    await requireInternalUser();

    // Get overall statistics
    const [stats] = await db
      .select({
        totalCustomers: sql<number>`count(distinct ${customers.id})`,
        activeSubscriptions: sql<number>`count(distinct case when ${subscriptions.status} = 'active' then ${subscriptions.id} end)`,
        trialingSubscriptions: sql<number>`count(distinct case when ${subscriptions.status} = 'trialing' then ${subscriptions.id} end)`,
        canceledSubscriptions: sql<number>`count(distinct case when ${subscriptions.status} = 'canceled' then ${subscriptions.id} end)`,
        openTickets: sql<number>`count(distinct case when ${supportTickets.status} = 'open' then ${supportTickets.id} end)`,
        inProgressTickets: sql<number>`count(distinct case when ${supportTickets.status} = 'in_progress' then ${supportTickets.id} end)`,
        activeLicenses: sql<number>`count(distinct case when ${licenseKeys.isActive} = true then ${licenseKeys.id} end)`,
        revokedLicenses: sql<number>`count(distinct case when ${licenseKeys.revokedAt} is not null then ${licenseKeys.id} end)`,
      })
      .from(customers)
      .leftJoin(subscriptions, eq(subscriptions.customerId, customers.id))
      .leftJoin(supportTickets, eq(supportTickets.customerId, customers.id))
      .leftJoin(licenseKeys, eq(licenseKeys.customerId, customers.id));

    // Get recent payments (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPayments = await db
      .select({
        totalRevenue: sql<number>`coalesce(sum(cast(${payments.amount} as decimal)), 0)`,
        paymentCount: sql<number>`count(${payments.id})`,
      })
      .from(payments)
      .where(
        gte(payments.createdAt, thirtyDaysAgo)
      );

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        recentRevenue: recentPayments[0]?.totalRevenue || 0,
        recentPaymentCount: recentPayments[0]?.paymentCount || 0,
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch statistics");
  }
}

