import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { subscriptions, licenseKeys, activations } from "@/lib/db/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/api/auth-helpers";
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";
import { successResponse, handleApiError } from "@/lib/api/response-helpers";

export async function GET(_request: NextRequest) {
  try {
    const session = await requireAuth();
    const customer = await getCustomerOrThrow(session.user.id);

    // Get active subscription
    const [subscription] = await db
      .select()
      .from(subscriptions)
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
      .limit(1);

    if (!subscription) {
      return successResponse({
        activations: [],
        licenseKeyInfo: null,
      });
    }

    // Get license key for this subscription
    const [licenseKey] = await db
      .select()
      .from(licenseKeys)
      .where(
        and(
          eq(licenseKeys.subscriptionId, subscription.id),
          eq(licenseKeys.isActive, true)
        )
      )
      .limit(1);

    if (!licenseKey) {
      return successResponse({
        activations: [],
        licenseKeyInfo: null,
      });
    }

    // Get all activations for this license key
    const terminalActivations = await db
      .select()
      .from(activations)
      .where(eq(activations.licenseKey, licenseKey.licenseKey))
      .orderBy(desc(activations.firstActivation));

    // Count active activations
    const activeCount = terminalActivations.filter((a) => a.isActive).length;

    return successResponse({
      activations: terminalActivations.map((activation) => ({
        id: activation.id,
        licenseKey: activation.licenseKey,
        terminalName: activation.terminalName,
        machineIdHash: activation.machineIdHash,
        firstActivation: activation.firstActivation,
        lastHeartbeat: activation.lastHeartbeat,
        isActive: activation.isActive,
        ipAddress: activation.ipAddress,
        location: activation.location as {
          city?: string;
          country?: string;
        } | null,
      })),
      licenseKeyInfo: {
        licenseKey: licenseKey.licenseKey,
        maxTerminals: licenseKey.maxTerminals,
        activationCount: activeCount,
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch terminals");
  }
}
