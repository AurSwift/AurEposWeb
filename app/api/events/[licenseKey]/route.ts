/**
 * SSE Event Stream Endpoint
 *
 * Server-Sent Events endpoint for real-time subscription notifications.
 * Desktop apps connect to this endpoint to receive instant updates about
 * subscription changes (cancellation, reactivation, plan changes, etc.)
 *
 * Flow:
 * 1. Desktop connects with license key
 * 2. Server validates license key exists
 * 3. Server subscribes to events for that license
 * 4. Events are pushed to desktop in real-time
 * 5. Periodic heartbeats keep connection alive
 *
 * Route: GET /api/events/[licenseKey]
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { licenseKeys, activations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  subscribeToLicense,
  serializeEvent,
  createSubscriptionEvent,
  type SubscriptionEvent,
} from "@/lib/subscription-events";

// SSE heartbeat interval (30 seconds)
const HEARTBEAT_INTERVAL_MS = 30 * 1000;

// Connection timeout (5 minutes of no activity)
const CONNECTION_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Validate license key and machine (optional)
 */
async function validateLicenseKey(
  licenseKey: string,
  machineIdHash?: string
): Promise<{ valid: boolean; error?: string }> {
  const normalizedKey = licenseKey.toUpperCase();

  console.log(
    `[SSE] Validating license: ${normalizedKey.substring(
      0,
      15
    )}..., machineId: ${machineIdHash?.substring(0, 20)}...`
  );

  // Check license exists and is active
  const [license] = await db
    .select()
    .from(licenseKeys)
    .where(
      and(
        eq(licenseKeys.licenseKey, normalizedKey),
        eq(licenseKeys.isActive, true)
      )
    )
    .limit(1);

  if (!license) {
    console.log(
      `[SSE] License not found or inactive: ${normalizedKey.substring(
        0,
        15
      )}...`
    );
    return { valid: false, error: "License key not found or inactive" };
  }

  console.log(`[SSE] License found: ${license.id}`);

  // If machine hash provided, verify it's activated
  if (machineIdHash) {
    // First, check what activations exist for this license
    const allActivations = await db
      .select()
      .from(activations)
      .where(eq(activations.licenseKey, normalizedKey));

    console.log(
      `[SSE] Found ${allActivations.length} activations for license:`,
      allActivations.map((a) => ({
        machineIdHash: a.machineIdHash?.substring(0, 20) + "...",
        isActive: a.isActive,
      }))
    );

    const [activation] = await db
      .select()
      .from(activations)
      .where(
        and(
          eq(activations.licenseKey, normalizedKey),
          eq(activations.machineIdHash, machineIdHash),
          eq(activations.isActive, true)
        )
      )
      .limit(1);

    if (!activation) {
      console.log(
        `[SSE] Machine not activated. Looking for: ${machineIdHash?.substring(
          0,
          20
        )}...`
      );
      return { valid: false, error: "Machine not activated for this license" };
    }

    console.log(`[SSE] Machine activation found: ${activation.id}`);
  }

  return { valid: true };
}

/**
 * GET /api/events/[licenseKey]
 *
 * Establishes an SSE connection for real-time subscription events
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ licenseKey: string }> }
) {
  const { licenseKey } = await params;
  const machineIdHash = request.nextUrl.searchParams.get("machineId");

  // Validate license key
  const validation = await validateLicenseKey(
    licenseKey,
    machineIdHash || undefined
  );
  if (!validation.valid) {
    return new Response(JSON.stringify({ error: validation.error }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const normalizedKey = licenseKey.toUpperCase();

  // Generate unique connection ID for logging
  const connectionId = `conn_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 9)}`;

  console.log(
    `[SSE] Client connected: ${connectionId} for license ${normalizedKey.substring(
      0,
      15
    )}...`
  );

  // Create readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let isActive = true;
      let lastActivity = Date.now();

      // Send initial connection confirmation
      const connectEvent = createSubscriptionEvent(
        "heartbeat_ack",
        normalizedKey,
        {
          serverTime: new Date().toISOString(),
          connectionId,
        }
      );
      controller.enqueue(encoder.encode(serializeEvent(connectEvent)));

      // Subscribe to events for this license key
      const unsubscribe = subscribeToLicense(
        normalizedKey,
        (event: SubscriptionEvent) => {
          if (!isActive) return;

          try {
            lastActivity = Date.now();
            controller.enqueue(encoder.encode(serializeEvent(event)));
            console.log(`[SSE] Sent ${event.type} to ${connectionId}`);
          } catch (error) {
            console.error(
              `[SSE] Failed to send event to ${connectionId}:`,
              error
            );
          }
        }
      );

      // Heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        if (!isActive) {
          clearInterval(heartbeatInterval);
          return;
        }

        // Check for timeout
        if (Date.now() - lastActivity > CONNECTION_TIMEOUT_MS) {
          console.log(`[SSE] Connection timeout: ${connectionId}`);
          clearInterval(heartbeatInterval);
          unsubscribe();
          isActive = false;
          try {
            controller.close();
          } catch {
            // Already closed
          }
          return;
        }

        // Send heartbeat
        try {
          const heartbeat = createSubscriptionEvent(
            "heartbeat_ack",
            normalizedKey,
            {
              serverTime: new Date().toISOString(),
              connectionId,
            }
          );
          controller.enqueue(encoder.encode(serializeEvent(heartbeat)));
        } catch {
          // Connection likely closed
          clearInterval(heartbeatInterval);
          unsubscribe();
          isActive = false;
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        console.log(`[SSE] Client disconnected: ${connectionId}`);
        clearInterval(heartbeatInterval);
        unsubscribe();
        isActive = false;
      });
    },
  });

  // Return SSE response
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
      "Access-Control-Allow-Origin": "*", // Adjust for production
    },
  });
}
