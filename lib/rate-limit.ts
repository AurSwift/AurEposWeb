/**
 * In-memory rate limiter for license API endpoints
 *
 * For production with multiple servers, use Redis-based rate limiting
 * (e.g., @upstash/ratelimit) instead.
 *
 * This implementation uses a sliding window algorithm with
 * per-IP and per-license-key rate limiting.
 */

// Rate limit configuration
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  blockDurationMs?: number; // Optional extended block duration after limit exceeded
}

// Rate limit result
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // Seconds until allowed again
}

// Request tracking
interface RequestRecord {
  count: number;
  windowStart: number;
  blockedUntil?: number;
}

// In-memory storage (replace with Redis in production)
const requestStore = new Map<string, RequestRecord>();

// Cleanup old entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  const cutoff = now - 60 * 60 * 1000; // Remove entries older than 1 hour

  for (const [key, record] of requestStore.entries()) {
    if (
      record.windowStart < cutoff &&
      (!record.blockedUntil || record.blockedUntil < now)
    ) {
      requestStore.delete(key);
    }
  }
}

/**
 * Check rate limit for a given identifier
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanup(); // Periodic cleanup

  const now = Date.now();
  const record = requestStore.get(identifier);

  // Check if currently blocked
  if (record?.blockedUntil && record.blockedUntil > now) {
    const retryAfter = Math.ceil((record.blockedUntil - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(record.blockedUntil),
      retryAfter,
    };
  }

  // Start new window if needed
  if (!record || now - record.windowStart >= config.windowMs) {
    requestStore.set(identifier, {
      count: 1,
      windowStart: now,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: new Date(now + config.windowMs),
    };
  }

  // Check if limit exceeded
  if (record.count >= config.maxRequests) {
    // Apply extended block if configured
    const blockedUntil = config.blockDurationMs
      ? now + config.blockDurationMs
      : record.windowStart + config.windowMs;

    record.blockedUntil = blockedUntil;

    const retryAfter = Math.ceil((blockedUntil - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(blockedUntil),
      retryAfter,
    };
  }

  // Increment counter
  record.count++;

  return {
    allowed: true,
    remaining: config.maxRequests - record.count,
    resetAt: new Date(record.windowStart + config.windowMs),
  };
}

// ============================================================================
// PRE-CONFIGURED RATE LIMITERS FOR LICENSE ENDPOINTS
// ============================================================================

/**
 * Rate limit configurations for different operations
 */
export const API_RATE_LIMITS = {
  // License operations
  activate: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    blockDurationMs: 60 * 60 * 1000, // 1 hour block
  },

  validate: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
  },

  heartbeat: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 12,
  },

  deactivate: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    blockDurationMs: 2 * 60 * 60 * 1000, // 2 hour block
  },

  // Public API endpoints
  plans: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute per IP
  },
} as const;

// Keep backward compatibility
export const LICENSE_RATE_LIMITS = API_RATE_LIMITS;

/**
 * Create composite identifier for rate limiting
 */
export function createRateLimitKey(
  endpoint: keyof typeof API_RATE_LIMITS,
  ...parts: string[]
): string {
  return `api:${endpoint}:${parts.filter(Boolean).join(":")}`;
}

/**
 * Apply rate limit and return Response if blocked
 */
export function applyRateLimit(
  endpoint: keyof typeof API_RATE_LIMITS,
  identifier: string
):
  | { blocked: true; response: Response }
  | { blocked: false; result: RateLimitResult } {
  const config = API_RATE_LIMITS[endpoint];
  const key = createRateLimitKey(endpoint, identifier);
  const result = checkRateLimit(key, config);

  if (!result.allowed) {
    return {
      blocked: true,
      response: new Response(
        JSON.stringify({
          success: false,
          error: "Too many requests. Please try again later.",
          retryAfter: result.retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(result.retryAfter),
            "X-RateLimit-Limit": String(config.maxRequests),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": result.resetAt.toISOString(),
          },
        }
      ),
    };
  }

  return { blocked: false, result };
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  headers: Headers,
  endpoint: keyof typeof API_RATE_LIMITS,
  result: RateLimitResult
): void {
  const config = API_RATE_LIMITS[endpoint];
  headers.set("X-RateLimit-Limit", String(config.maxRequests));
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  headers.set("X-RateLimit-Reset", result.resetAt.toISOString());
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get client IP from request headers
 */
export function getClientIP(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");

  return (
    cfConnectingIp || forwardedFor?.split(",")[0]?.trim() || realIp || "unknown"
  );
}

/**
 * Hash identifier for privacy (use for logging)
 */
export function hashIdentifier(identifier: string): string {
  // Simple hash for logging purposes
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}
