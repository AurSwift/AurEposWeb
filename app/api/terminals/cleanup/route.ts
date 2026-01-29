import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subscriptions, licenseKeys, activations } from "@/lib/db/schema";
import { eq, and, or, desc, lt, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/api/auth-helpers";
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";
import {
  successResponse,
  handleApiError,
  NotFoundError,
} from "@/lib/api/response-helpers";
import { publishLicenseRevoked } from "@/lib/subscription-events/redis-publisher";

// Stale threshold: 24 hours
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * GET /api/terminals/cleanup
 * Get count of stale terminals that would be cleaned up
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await requireAuth();
    const customer = await getCustomerOrThrow(session.user.id);

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
      return successResponse({
        staleCount: 0,
        message: "No active subscription found",
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
        staleCount: 0,
        message: "No license key found",
      });
    }

    // Calculate stale threshold timestamp
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);

    // Get all activations for this license
    const allActivations = await db
      .select()
      .from(activations)
      .where(eq(activations.licenseKey, licenseKey.licenseKey));

    // Count stale terminals:
    // - Already inactive, OR
    // - Last heartbeat > 24 hours ago (or never connected)
    const staleTerminals = allActivations.filter((a) => {
      if (!a.isActive) return true;
      if (!a.lastHeartbeat) return true; // Never connected
      return new Date(a.lastHeartbeat) < staleThreshold;
    });

    return successResponse({
      staleCount: staleTerminals.length,
      totalCount: allActivations.length,
      staleTerminals: staleTerminals.map((t) => ({
        id: t.id,
        terminalName: t.terminalName,
        isActive: t.isActive,
        lastHeartbeat: t.lastHeartbeat,
      })),
    });
  } catch (error) {
    return handleApiError(error, "Failed to get stale terminal count");
  }
}

/**
 * POST /api/terminals/cleanup
 * Remove all stale terminals (inactive or offline > 24 hours)
 */
export async function POST(_request: NextRequest) {
  try {
    const session = await requireAuth();
    const customer = await getCustomerOrThrow(session.user.id);

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

    // Calculate stale threshold timestamp
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);

    // Get all activations for this license
    const allActivations = await db
      .select()
      .from(activations)
      .where(eq(activations.licenseKey, licenseKey.licenseKey));

    // Find stale terminals
    const staleTerminalIds = allActivations
      .filter((a) => {
        if (!a.isActive) return true;
        if (!a.lastHeartbeat) return true;
        return new Date(a.lastHeartbeat) < staleThreshold;
      })
      .map((a) => a.id);

    if (staleTerminalIds.length === 0) {
      return successResponse({
        success: true,
        message: "No stale terminals to clean up",
        cleanedCount: 0,
      });
    }

    // Deactivate all stale terminals
    let cleanedCount = 0;
    const activeTerminalsBeingCleaned: string[] = [];

    for (const id of staleTerminalIds) {
      // Check if this terminal was active (to send SSE)
      const terminal = allActivations.find((a) => a.id === id);
      if (terminal?.isActive) {
        activeTerminalsBeingCleaned.push(terminal.terminalName || "Unknown");
      }

      await db
        .update(activations)
        .set({
          isActive: false,
          updatedAt: new Date(),
          location: sql`jsonb_set(
            COALESCE(${activations.location}, '{}'::jsonb),
            '{cleanedAt}',
            ${JSON.stringify(new Date().toISOString())}::jsonb
          )`,
        })
        .where(eq(activations.id, id));
      cleanedCount++;
    }

    console.log(
      `[Terminal Cleanup] ${cleanedCount} stale terminals cleaned up for license ${licenseKey.licenseKey} by user ${session.user.id}`
    );

    // Publish SSE event to notify any connected desktop apps in real-time
    if (activeTerminalsBeingCleaned.length > 0) {
      try {
        publishLicenseRevoked(licenseKey.licenseKey, {
          reason: `Stale terminals cleaned up from dashboard: ${activeTerminalsBeingCleaned.join(", ")}`,
        });
        console.log(
          `[Terminal Cleanup] SSE event published to license ${licenseKey.licenseKey.substring(0, 15)}...`
        );
      } catch (sseError) {
        console.error("[Terminal Cleanup] Failed to publish SSE event:", sseError);
      }
    }

    return successResponse({
      success: true,
      message: `Successfully cleaned up ${cleanedCount} stale terminal(s)`,
      cleanedCount,
    });
  } catch (error) {
    return handleApiError(error, "Failed to cleanup stale terminals");
  }
}
