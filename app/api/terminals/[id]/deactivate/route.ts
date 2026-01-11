import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subscriptions, licenseKeys, activations } from "@/lib/db/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/api/auth-helpers";
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";
import {
  successResponse,
  handleApiError,
  NotFoundError,
  ForbiddenError,
} from "@/lib/api/response-helpers";
import { publishLicenseRevoked } from "@/lib/subscription-events/redis-publisher";

/**
 * POST /api/terminals/[id]/deactivate
 * Deactivate a terminal by its activation ID
 *
 * This is a dashboard-initiated deactivation (owner has full control).
 * Unlike the desktop-app deactivation, this bypasses the yearly limit.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const customer = await getCustomerOrThrow(session.user.id);
    const { id: activationId } = await params;

    if (!activationId) {
      return NextResponse.json(
        { error: "Activation ID is required" },
        { status: 400 }
      );
    }

    // Get active subscription for this customer
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
      throw new NotFoundError("No active subscription found");
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
      throw new NotFoundError("No license key found for subscription");
    }

    // Find the activation
    const [activation] = await db
      .select()
      .from(activations)
      .where(eq(activations.id, activationId))
      .limit(1);

    if (!activation) {
      throw new NotFoundError("Terminal not found");
    }

    // Verify the activation belongs to this customer's license
    if (activation.licenseKey !== licenseKey.licenseKey) {
      throw new ForbiddenError("This terminal does not belong to your license");
    }

    // Check if already deactivated
    if (!activation.isActive) {
      return successResponse({
        success: true,
        message: "Terminal was already deactivated",
        terminalName: activation.terminalName,
      });
    }

    // Deactivate the terminal
    await db
      .update(activations)
      .set({
        isActive: false,
        updatedAt: new Date(),
        // Store deactivation metadata
        location: {
          ...((activation.location as object) || {}),
          deactivatedAt: new Date().toISOString(),
          deactivatedBy: "dashboard",
          deactivatedByUserId: session.user.id,
        },
      })
      .where(eq(activations.id, activationId));

    console.log(
      `[Terminal Deactivation] Terminal ${activationId} (${activation.terminalName}) deactivated by user ${session.user.id}`
    );

    // Publish SSE event to notify the connected desktop app in real-time
    try {
      publishLicenseRevoked(licenseKey.licenseKey, {
        reason: `Terminal "${activation.terminalName || "Unknown"}" was deactivated from the dashboard`,
      });
      console.log(
        `[Terminal Deactivation] SSE event published to license ${licenseKey.licenseKey.substring(0, 15)}...`
      );
    } catch (sseError) {
      // Log but don't fail - SSE is best-effort
      console.error("[Terminal Deactivation] Failed to publish SSE event:", sseError);
    }

    return successResponse({
      success: true,
      message: "Terminal deactivated successfully",
      terminalName: activation.terminalName,
    });
  } catch (error) {
    return handleApiError(error, "Failed to deactivate terminal");
  }
}
