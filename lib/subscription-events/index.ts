/**
 * Subscription Events Module
 *
 * Exports all subscription event types and publisher functions.
 *
 * Architecture:
 * - Uses Redis pub/sub when REDIS_URL is configured (production)
 * - Falls back to in-memory EventEmitter when Redis is not available (development)
 *
 * This module provides a unified API regardless of the underlying transport.
 */

// Export types and helper functions
export * from "./types";

// Export Redis-backed publisher (with in-memory fallback)
export {
  publishEvent,
  publishEventSync,
  subscribeToLicense,
  getSubscriberCount,
  publishSubscriptionCancelled,
  publishSubscriptionReactivated,
  publishSubscriptionUpdated,
  publishSubscriptionPastDue,
  publishPaymentSucceeded,
  publishLicenseRevoked,
  publishLicenseReactivated,
  publishPlanChanged,
  getLicenseKeysForSubscription,
  broadcastToSubscription,
} from "./redis-publisher";
