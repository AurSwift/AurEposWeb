/**
 * Redis Client Singleton
 *
 * Provides Redis connections for pub/sub functionality across server instances.
 * Uses ioredis with automatic reconnection and error handling.
 *
 * Environment:
 * - REDIS_URL: Redis connection string (required for production)
 *   Format: redis://[:password@]host[:port][/database]
 *   For Upstash: rediss://default:password@host:port
 *
 * Architecture:
 * - Publisher: Used to publish events (one per server instance)
 * - Subscriber: Used to listen for events (one per SSE connection)
 *
 * Note: In Redis pub/sub, a connection in subscriber mode cannot publish.
 * That's why we maintain separate connections for publishing and subscribing.
 */

import Redis, { RedisOptions } from "ioredis";

// ============================================================================
// CONFIGURATION
// ============================================================================

const REDIS_URL = process.env.REDIS_URL;

/**
 * Check if Redis is configured
 */
export function isRedisConfigured(): boolean {
  return !!REDIS_URL;
}

/**
 * Common Redis options for both publisher and subscriber
 */
function getRedisOptions(): RedisOptions {
  const options: RedisOptions = {
    // Connection settings
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      // Exponential backoff with max 30 seconds
      const delay = Math.min(times * 100, 30000);
      console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
      return delay;
    },

    // Reconnection settings
    reconnectOnError(err: Error) {
      const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
      return targetErrors.some((e) => err.message.includes(e));
    },

    // Enable TLS for Upstash and other cloud providers (rediss://)
    ...(REDIS_URL?.startsWith("rediss://") && {
      tls: {
        rejectUnauthorized: false,
      },
    }),

    // Timeouts
    connectTimeout: 10000,
    commandTimeout: 5000,

    // Keep alive
    keepAlive: 30000,

    // Lazy connect - only connect when first command is issued
    lazyConnect: true,
  };

  return options;
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

/**
 * Publisher instance - used to publish events to channels
 * Singleton to ensure only one connection per server instance
 */
let publisherInstance: Redis | null = null;

/**
 * Get or create the publisher Redis client
 * This is a singleton - same instance is reused across all publish calls
 */
export function getPublisher(): Redis | null {
  if (!isRedisConfigured()) {
    console.warn(
      "[Redis] REDIS_URL not configured - falling back to in-memory events"
    );
    return null;
  }

  if (!publisherInstance) {
    publisherInstance = new Redis(REDIS_URL!, getRedisOptions());

    publisherInstance.on("connect", () => {
      console.log("[Redis] Publisher connected");
    });

    publisherInstance.on("error", (err) => {
      console.error("[Redis] Publisher error:", err.message);
    });

    publisherInstance.on("close", () => {
      console.log("[Redis] Publisher connection closed");
    });

    publisherInstance.on("reconnecting", () => {
      console.log("[Redis] Publisher reconnecting...");
    });

    // Initiate connection
    publisherInstance.connect().catch((err) => {
      console.error("[Redis] Publisher failed to connect:", err.message);
    });
  }

  return publisherInstance;
}

/**
 * Create a new subscriber Redis client
 * Each SSE connection needs its own subscriber instance because
 * a Redis client in subscriber mode is dedicated to that purpose
 */
export function createSubscriber(): Redis | null {
  if (!isRedisConfigured()) {
    return null;
  }

  const subscriber = new Redis(REDIS_URL!, getRedisOptions());

  subscriber.on("connect", () => {
    console.log("[Redis] Subscriber connected");
  });

  subscriber.on("error", (err) => {
    console.error("[Redis] Subscriber error:", err.message);
  });

  subscriber.on("close", () => {
    console.log("[Redis] Subscriber connection closed");
  });

  // Initiate connection
  subscriber.connect().catch((err) => {
    console.error("[Redis] Subscriber failed to connect:", err.message);
  });

  return subscriber;
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Close all Redis connections
 * Call this on server shutdown
 */
export async function closeRedisConnections(): Promise<void> {
  if (publisherInstance) {
    await publisherInstance.quit();
    publisherInstance = null;
    console.log("[Redis] Publisher disconnected");
  }
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Check if Redis connection is healthy
 */
export async function isRedisHealthy(): Promise<boolean> {
  if (!isRedisConfigured()) {
    return false;
  }

  try {
    const publisher = getPublisher();
    if (!publisher) return false;

    const result = await publisher.ping();
    return result === "PONG";
  } catch (error) {
    console.error("[Redis] Health check failed:", error);
    return false;
  }
}

/**
 * Get Redis connection status
 */
export function getRedisStatus(): {
  configured: boolean;
  publisherConnected: boolean;
} {
  return {
    configured: isRedisConfigured(),
    publisherConnected: publisherInstance?.status === "ready",
  };
}
