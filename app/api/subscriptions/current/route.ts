import { db } from "@/lib/db";
import { subscriptions, licenseKeys } from "@/lib/db/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/api/auth-helpers";
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";
import { handleApiError, successResponse } from "@/lib/api/response-helpers";

export async function GET() {
  try {
    const session = await requireAuth();
    const customer = await getCustomerOrThrow(session.user.id);

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
      return successResponse({ subscription: null });
    }

    // Group license keys by subscription
    const subscription = result[0].subscription;
    const licenseKeysArray = result
      .filter((r) => r.licenseKey !== null)
      .map((r) => r.licenseKey);

    return successResponse({
      subscription: {
        ...subscription,
        licenseKeys: licenseKeysArray,
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch subscription");
  }
}
