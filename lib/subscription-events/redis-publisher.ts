/**
 * Redis-Backed Subscription Event Publisher
 *
 * Publishes subscription events to Redis pub/sub for cross-instance delivery.
 * Falls back to in-memory EventEmitter when Redis is not configured.
 *
 * Architecture:
 * - In production (Redis configured): Events published to Redis, all server
 *   instances receive and forward to their connected SSE clients
 * - In development (no Redis): Falls back to in-memory EventEmitter which
 *   works for single-instance deployments
 *
 * Channel naming: `sse:license:{licenseKey}`
 */

import { EventEmitter } from "events";
import {
  getPublisher,
  createSubscriber,
  isRedisConfigured,
} from "@/lib/redis/client";
import {
  SubscriptionEvent,
  createSubscriptionEvent,
  generateEventId,
  type SubscriptionEventType,
} from "./types";
import { db } from "@/lib/db";
import { subscriptionEvents, licenseKeys } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// ============================================================================
// CHANNEL NAMING
// ============================================================================

/**
 * Get Redis channel name for a license key
 */
function getChannelName(licenseKey: string): string {
  return `sse:license:${licenseKey.toUpperCase()}`;
}

// ============================================================================
// FALLBACK IN-MEMORY EVENT EMITTER
// ============================================================================

/**
 * In-memory fallback for when Redis is not configured
 * Used in development or single-instance deployments
 */
class InMemoryEventEmitter extends EventEmitter {
  private static instance: InMemoryEventEmitter;

  private constructor() {
    super();
    this.setMaxListeners(1000);
  }

  static getInstance(): InMemoryEventEmitter {
    if (!InMemoryEventEmitter.instance) {
      InMemoryEventEmitter.instance = new InMemoryEventEmitter();
    }
    return InMemoryEventEmitter.instance;
  }
}

const fallbackEmitter = InMemoryEventEmitter.getInstance();

// ============================================================================
// PUBLISHER FUNCTIONS
// ============================================================================

/**
 * Publish an event to all subscribers of a license key
 * Uses Redis if configured, otherwise falls back to in-memory
 * Persists events to database for 24-hour replay capability
 */
export async function publishEvent(event: SubscriptionEvent): Promise<void> {
  const channel = getChannelName(event.licenseKey);
  const serializedEvent = JSON.stringify(event);

  console.log(`[SSE Publisher] Publishing ${event.type} to ${channel}`);

  // Step 1: Persist to database for event replay (24hr TTL)
  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour TTL

    await db.insert(subscriptionEvents).values({
      eventId: event.id,
      licenseKey: event.licenseKey,
      eventType: event.type,
      payload: event.data,
      createdAt: new Date(event.timestamp),
      expiresAt,
    });

    console.log(
      `[SSE Publisher] ✅ Persisted to DB: ${
        event.id
      } (expires: ${expiresAt.toISOString()})`
    );
  } catch (error) {
    // Log but don't fail - persistence is best-effort
    console.error("[SSE Publisher] ⚠️ Failed to persist event to DB:", error);
  }

  // Step 2: Try Redis publish
  const publisher = getPublisher();
  if (publisher) {
    try {
      await publisher.publish(channel, serializedEvent);
      console.log(`[SSE Publisher] ✅ Published via Redis: ${event.id}`);
      return;
    } catch (error) {
      console.error(
        "[SSE Publisher] Redis publish failed, using fallback:",
        error
      );
      // Fall through to in-memory fallback
    }
  }

  // Step 3: Fallback to in-memory
  fallbackEmitter.emit(channel, event);
  console.log(`[SSE Publisher] Published via in-memory fallback: ${event.id}`);
}

/**
 * Synchronous version of publishEvent for backward compatibility
 * Logs warning if Redis publish fails
 */
export function publishEventSync(event: SubscriptionEvent): void {
  // Fire and forget - don't await
  publishEvent(event).catch((error) => {
    console.error("[SSE Publisher] Async publish failed:", error);
  });
}

/**
 * Subscribe to events for a specific license key
 * Returns cleanup function
 *
 * @param licenseKey - The license key to subscribe to
 * @param callback - Function called when events are received
 * @returns Cleanup function to unsubscribe
 */
export function subscribeToLicense(
  licenseKey: string,
  callback: (event: SubscriptionEvent) => void
): () => void {
  const channel = getChannelName(licenseKey);

  // Try Redis subscription
  if (isRedisConfigured()) {
    const subscriber = createSubscriber();

    if (subscriber) {
      // Set up message handler
      const messageHandler = (receivedChannel: string, message: string) => {
        if (receivedChannel === channel) {
          try {
            const event = JSON.parse(message) as SubscriptionEvent;
            callback(event);
          } catch (error) {
            console.error("[SSE Subscriber] Failed to parse event:", error);
          }
        }
      };

      subscriber.on("message", messageHandler);

      // Subscribe to channel
      subscriber.subscribe(channel).catch((error) => {
        console.error("[SSE Subscriber] Failed to subscribe:", error);
      });

      console.log(`[SSE Subscriber] Subscribed to ${channel} via Redis`);

      // Return cleanup function
      return () => {
        subscriber.unsubscribe(channel).catch(() => {});
        subscriber.off("message", messageHandler);
        subscriber.quit().catch(() => {});
        console.log(`[SSE Subscriber] Unsubscribed from ${channel}`);
      };
    }
  }

  // Fallback to in-memory subscription
  const inMemoryHandler = (event: SubscriptionEvent) => {
    callback(event);
  };

  fallbackEmitter.on(channel, inMemoryHandler);
  console.log(
    `[SSE Subscriber] Subscribed to ${channel} via in-memory fallback`
  );

  return () => {
    fallbackEmitter.off(channel, inMemoryHandler);
    console.log(`[SSE Subscriber] Unsubscribed from ${channel} (in-memory)`);
  };
}

/**
 * Get number of in-memory subscribers for a license key
 * Note: Redis subscriber count not easily accessible without PUBSUB NUMSUB
 */
export function getSubscriberCount(licenseKey: string): number {
  const channel = getChannelName(licenseKey);
  return fallbackEmitter.listenerCount(channel);
}

// ============================================================================
// CONVENIENCE FUNCTIONS FOR COMMON EVENTS
// ============================================================================

/**
 * Publish subscription cancelled event
 */
export function publishSubscriptionCancelled(
  licenseKey: string,
  data: {
    cancelledAt: Date;
    cancelImmediately: boolean;
    gracePeriodEnd: Date | null;
    reason?: string;
  }
): void {
  const event = createSubscriptionEvent("subscription_cancelled", licenseKey, {
    cancelledAt: data.cancelledAt.toISOString(),
    cancelImmediately: data.cancelImmediately,
    gracePeriodEnd: data.gracePeriodEnd?.toISOString() || null,
    reason: data.reason,
  });
  publishEventSync(event);
}

/**
 * Publish subscription reactivated event
 */
export function publishSubscriptionReactivated(
  licenseKey: string,
  data: {
    subscriptionStatus: string;
    planId: string;
  }
): void {
  const event = createSubscriptionEvent(
    "subscription_reactivated",
    licenseKey,
    {
      reactivatedAt: new Date().toISOString(),
      subscriptionStatus: data.subscriptionStatus,
      planId: data.planId,
    }
  );
  publishEventSync(event);
}

/**
 * Publish subscription status update event
 */
export function publishSubscriptionUpdated(
  licenseKey: string,
  data: {
    previousStatus: string;
    newStatus: string;
    shouldDisable: boolean;
    gracePeriodRemaining: number | null;
  }
): void {
  const event = createSubscriptionEvent(
    "subscription_updated",
    licenseKey,
    data
  );
  publishEventSync(event);
}

/**
 * Publish subscription past due event
 */
export function publishSubscriptionPastDue(
  licenseKey: string,
  data: {
    pastDueSince: Date;
    gracePeriodEnd: Date;
    amountDue: number;
    currency: string;
  }
): void {
  const event = createSubscriptionEvent("subscription_past_due", licenseKey, {
    pastDueSince: data.pastDueSince.toISOString(),
    gracePeriodEnd: data.gracePeriodEnd.toISOString(),
    amountDue: data.amountDue,
    currency: data.currency,
  });
  publishEventSync(event);
}

/**
 * Publish payment succeeded event
 */
export function publishPaymentSucceeded(
  licenseKey: string,
  data: {
    amount: number;
    currency: string;
    subscriptionStatus: string;
  }
): void {
  const event = createSubscriptionEvent(
    "subscription_payment_succeeded",
    licenseKey,
    {
      paidAt: new Date().toISOString(),
      amount: data.amount,
      currency: data.currency,
      subscriptionStatus: data.subscriptionStatus,
    }
  );
  publishEventSync(event);
}

/**
 * Publish license revoked event
 */
export function publishLicenseRevoked(
  licenseKey: string,
  data: {
    reason: string;
  }
): void {
  const event = createSubscriptionEvent("license_revoked", licenseKey, {
    revokedAt: new Date().toISOString(),
    reason: data.reason,
    shouldDisable: true,
  });
  publishEventSync(event);
}

/**
 * Publish license reactivated event
 */
export function publishLicenseReactivated(
  licenseKey: string,
  data: {
    planId: string;
    features: string[];
  }
): void {
  const event = createSubscriptionEvent("license_reactivated", licenseKey, {
    reactivatedAt: new Date().toISOString(),
    planId: data.planId,
    features: data.features,
  });
  publishEventSync(event);
}

/**
 * Publish plan changed event
 */
export function publishPlanChanged(
  licenseKey: string,
  data: {
    previousPlanId: string;
    newPlanId: string;
    newFeatures: string[];
    effectiveAt: Date;
  }
): void {
  const event = createSubscriptionEvent("plan_changed", licenseKey, {
    previousPlanId: data.previousPlanId,
    newPlanId: data.newPlanId,
    newFeatures: data.newFeatures,
    effectiveAt: data.effectiveAt.toISOString(),
  });
  publishEventSync(event);
}

// ============================================================================
// UTILITY: GET ALL LICENSE KEYS FOR A SUBSCRIPTION
// ============================================================================

/**
 * Get all license keys associated with a subscription
 * Used to broadcast events to all terminals
 */
export async function getLicenseKeysForSubscription(
  subscriptionId: string
): Promise<string[]> {
  const licenses = await db
    .select({ licenseKey: licenseKeys.licenseKey })
    .from(licenseKeys)
    .where(eq(licenseKeys.subscriptionId, subscriptionId));

  return licenses.map((l) => l.licenseKey);
}

/**
 * Broadcast an event to all license keys of a subscription
 */
export async function broadcastToSubscription(
  subscriptionId: string,
  eventType: SubscriptionEventType,
  data: Record<string, unknown>
): Promise<void> {
  const keys = await getLicenseKeysForSubscription(subscriptionId);

  for (const licenseKey of keys) {
    const event: SubscriptionEvent = {
      id: generateEventId(),
      type: eventType,
      timestamp: new Date().toISOString(),
      licenseKey,
      data,
    } as SubscriptionEvent;

    await publishEvent(event);
  }
}
