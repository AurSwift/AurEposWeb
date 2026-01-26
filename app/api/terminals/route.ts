import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  subscriptions,
  licenseKeys,
  activations,
  terminalSessions,
} from "@/lib/db/schema";
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

    // Get live terminal sessions for real-time status
    const liveSessions = await db
      .select()
      .from(terminalSessions)
      .where(eq(terminalSessions.licenseKey, licenseKey.licenseKey));

    console.log("[API /terminals] Live sessions found:", {
      count: liveSessions.length,
      licenseKey: licenseKey.licenseKey,
      sessions: liveSessions.map((s) => ({
        machineIdHash: s.machineIdHash?.substring(0, 20) + "...",
        connectionStatus: s.connectionStatus,
        lastHeartbeatAt: s.lastHeartbeatAt,
      })),
    });

    // Create a map of machineIdHash -> session for quick lookup
    const sessionMap = new Map(liveSessions.map((s) => [s.machineIdHash, s]));

    console.log("[API /terminals] Activations to check:", {
      count: terminalActivations.length,
      activations: terminalActivations.map((a) => ({
        machineIdHash: a.machineIdHash?.substring(0, 20) + "...",
        isActive: a.isActive,
      })),
    });

    // Count active activations
    const activeCount = terminalActivations.filter((a) => a.isActive).length;

    return successResponse({
      activations: terminalActivations.map((activation) => {
        // Check for live session with more recent heartbeat
        const liveSession = activation.machineIdHash
          ? sessionMap.get(activation.machineIdHash)
          : null;

        console.log("[API /terminals] Checking activation:", {
          machineIdHash: activation.machineIdHash?.substring(0, 20) + "...",
          foundLiveSession: !!liveSession,
          liveSessionStatus: liveSession?.connectionStatus,
        });

        // Use the most recent heartbeat from either source
        const activationHeartbeat = activation.lastHeartbeat
          ? new Date(activation.lastHeartbeat)
          : null;
        const sessionHeartbeat = liveSession?.lastHeartbeatAt
          ? new Date(liveSession.lastHeartbeatAt)
          : null;

        // Pick the more recent heartbeat
        let lastHeartbeat = activationHeartbeat;
        if (sessionHeartbeat) {
          if (!lastHeartbeat || sessionHeartbeat > lastHeartbeat) {
            lastHeartbeat = sessionHeartbeat;
          }
        }

        // Check if terminal has active SSE connection
        const isLiveConnected =
          liveSession?.connectionStatus === "connected" &&
          sessionHeartbeat &&
          Date.now() - sessionHeartbeat.getTime() < 5 * 60 * 1000; // Within 5 minutes

        return {
          id: activation.id,
          licenseKey: activation.licenseKey,
          terminalName: activation.terminalName,
          machineIdHash: activation.machineIdHash,
          firstActivation: activation.firstActivation,
          lastHeartbeat: lastHeartbeat,
          isActive: activation.isActive,
          isLiveConnected, // New field for real-time status
          ipAddress: activation.ipAddress,
          location: activation.location as {
            city?: string;
            country?: string;
          } | null,
        };
      }),
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
