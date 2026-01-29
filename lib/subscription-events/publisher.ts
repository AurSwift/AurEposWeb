/**
 * Subscription Event Publisher
 *
 * In-memory event bus for publishing subscription events to connected SSE clients.
 * Uses EventEmitter pattern for simplicity - can be upgraded to Redis pub/sub for
 * horizontal scaling across multiple server instances.
 *
 * Architecture:
 * - Webhook handlers call publishEvent() when subscription state changes
 * - SSE endpoint subscribes to events for specific license keys
 * - Events are delivered in real-time to connected desktop clients
 */

import { EventEmitter } from "events";
import {
  SubscriptionEvent,
  createSubscriptionEvent,
  generateEventId,
  type SubscriptionEventType,
} from "./types";

// ============================================================================
// EVENT EMITTER SETUP
// ============================================================================

/**
 * Global event emitter for subscription events
 * In production with multiple servers, replace with Redis pub/sub
 */
class SubscriptionEventEmitter extends EventEmitter {
  private static instance: SubscriptionEventEmitter;

  private constructor() {
    super();
    // Increase max listeners for many concurrent SSE connections
    this.setMaxListeners(1000);
  }

  static getInstance(): SubscriptionEventEmitter {
    if (!SubscriptionEventEmitter.instance) {
      SubscriptionEventEmitter.instance = new SubscriptionEventEmitter();
    }
    return SubscriptionEventEmitter.instance;
  }
}

const eventEmitter = SubscriptionEventEmitter.getInstance();

// ============================================================================
// PUBLISHER FUNCTIONS
// ============================================================================

/**
 * Publish an event to all subscribers of a license key
 */
export function publishEvent(event: SubscriptionEvent): void {
  const channel = `license:${event.licenseKey}`;
  console.log(`[SSE] Publishing ${event.type} to ${channel}`);
  eventEmitter.emit(channel, event);
}

/**
 * Subscribe to events for a specific license key
 * Returns unsubscribe function
 */
export function subscribeToLicense(
  licenseKey: string,
  callback: (event: SubscriptionEvent) => void
): () => void {
  const channel = `license:${licenseKey}`;
  eventEmitter.on(channel, callback);

  return () => {
    eventEmitter.off(channel, callback);
  };
}

/**
 * Get number of active subscribers for a license key
 */
export function getSubscriberCount(licenseKey: string): number {
  const channel = `license:${licenseKey}`;
  return eventEmitter.listenerCount(channel);
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
  publishEvent(event);
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
  publishEvent(event);
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
    trialEnd?: string | null;
  }
): void {
  const event = createSubscriptionEvent(
    "subscription_updated",
    licenseKey,
    data
  );
  publishEvent(event);
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
  publishEvent(event);
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
  publishEvent(event);
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
  publishEvent(event);
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
  publishEvent(event);
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
  publishEvent(event);
}

// ============================================================================
// UTILITY: GET ALL LICENSE KEYS FOR A SUBSCRIPTION
// ============================================================================

import { db } from "@/lib/db";
import { licenseKeys } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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

    publishEvent(event);
  }
}
