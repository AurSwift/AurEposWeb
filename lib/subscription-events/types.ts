/**
 * Subscription Events Types
 *
 * Shared type definitions for real-time subscription event notifications
 * between the web API and desktop app via SSE (Server-Sent Events).
 */

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Types of subscription events that trigger desktop notifications
 */
export type SubscriptionEventType =
  | "subscription_cancelled"
  | "subscription_reactivated"
  | "subscription_updated"
  | "subscription_past_due"
  | "subscription_payment_succeeded"
  | "license_revoked"
  | "license_reactivated"
  | "plan_changed"
  | "heartbeat_ack"
  | "terminal_added"
  | "terminal_removed"
  | "terminal_reconnected"
  | "primary_changed"
  | "state_sync"
  | "deactivation_broadcast"; // Server acknowledgment for connection health

/**
 * Base event structure
 */
export interface BaseSubscriptionEvent {
  id: string; // Unique event ID for idempotency
  type: SubscriptionEventType;
  timestamp: string; // ISO 8601
  licenseKey: string;
}

/**
 * Subscription cancelled event
 */
export interface SubscriptionCancelledEvent extends BaseSubscriptionEvent {
  type: "subscription_cancelled";
  data: {
    cancelledAt: string;
    cancelImmediately: boolean;
    gracePeriodEnd: string | null;
    reason?: string;
  };
}

/**
 * Subscription reactivated event
 */
export interface SubscriptionReactivatedEvent extends BaseSubscriptionEvent {
  type: "subscription_reactivated";
  data: {
    reactivatedAt: string;
    subscriptionStatus: string;
    planId: string;
  };
}

/**
 * Subscription updated event (status change)
 */
export interface SubscriptionUpdatedEvent extends BaseSubscriptionEvent {
  type: "subscription_updated";
  data: {
    previousStatus: string;
    newStatus: string;
    shouldDisable: boolean;
    gracePeriodRemaining: number | null;
    trialEnd?: string | null; // Trial end date (null when trial ends)
  };
}

/**
 * Subscription past due event
 */
export interface SubscriptionPastDueEvent extends BaseSubscriptionEvent {
  type: "subscription_past_due";
  data: {
    pastDueSince: string;
    gracePeriodEnd: string;
    amountDue: number;
    currency: string;
  };
}

/**
 * Payment succeeded event
 */
export interface SubscriptionPaymentSucceededEvent
  extends BaseSubscriptionEvent {
  type: "subscription_payment_succeeded";
  data: {
    paidAt: string;
    amount: number;
    currency: string;
    subscriptionStatus: string;
  };
}

/**
 * License revoked event
 */
export interface LicenseRevokedEvent extends BaseSubscriptionEvent {
  type: "license_revoked";
  data: {
    revokedAt: string;
    reason: string;
    shouldDisable: boolean;
  };
}

/**
 * License reactivated event
 */
export interface LicenseReactivatedEvent extends BaseSubscriptionEvent {
  type: "license_reactivated";
  data: {
    reactivatedAt: string;
    planId: string;
    features: string[];
  };
}

/**
 * Plan changed event
 */
export interface PlanChangedEvent extends BaseSubscriptionEvent {
  type: "plan_changed";
  data: {
    previousPlanId: string;
    newPlanId: string;
    newFeatures: string[];
    effectiveAt: string;
  };
}

/**
 * Heartbeat acknowledgment (sent periodically to keep connection alive)
 */
export interface HeartbeatAckEvent extends BaseSubscriptionEvent {
  type: "heartbeat_ack";
  data: {
    serverTime: string;
    connectionId: string;
  };
}

/**
 * Coordination event (multi-terminal sync)
 */
export interface CoordinationEvent extends BaseSubscriptionEvent {
  type:
    | "terminal_added"
    | "terminal_removed"
    | "terminal_reconnected"
    | "primary_changed"
    | "state_sync"
    | "deactivation_broadcast";
  data: Record<string, any>;
}

/**
 * Union type for all subscription events
 */
export type SubscriptionEvent =
  | SubscriptionCancelledEvent
  | SubscriptionReactivatedEvent
  | SubscriptionUpdatedEvent
  | SubscriptionPastDueEvent
  | SubscriptionPaymentSucceededEvent
  | LicenseRevokedEvent
  | LicenseReactivatedEvent
  | PlanChangedEvent
  | HeartbeatAckEvent
  | CoordinationEvent;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique event ID
 */
export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a subscription event
 */
export function createSubscriptionEvent<T extends SubscriptionEvent>(
  type: T["type"],
  licenseKey: string,
  data: T["data"]
): T {
  return {
    id: generateEventId(),
    type,
    timestamp: new Date().toISOString(),
    licenseKey,
    data,
  } as T;
}

/**
 * Serialize event for SSE transmission
 */
export function serializeEvent(event: SubscriptionEvent): string {
  return `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(
    event
  )}\n\n`;
}

/**
 * Parse SSE event data
 */
export function parseEventData(data: string): SubscriptionEvent | null {
  try {
    return JSON.parse(data) as SubscriptionEvent;
  } catch {
    return null;
  }
}
