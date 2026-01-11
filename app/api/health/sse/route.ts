/**
 * Redis & SSE Health Check Endpoint
 *
 * Provides health status for Redis pub/sub and SSE infrastructure.
 * Useful for monitoring and debugging real-time sync issues.
 *
 * Route: GET /api/health/sse
 */

import { NextResponse } from "next/server";
import { isRedisConfigured, isRedisHealthy, getRedisStatus } from "@/lib/redis";

export async function GET() {
  const status = await getRedisStatus();
  const healthy = status.healthy;

  const response = {
    status: healthy ? "healthy" : status.configured ? "degraded" : "fallback",
    timestamp: new Date().toISOString(),
    redis: {
      configured: status.configured,
      connected: status.publisherConnected,
      healthy,
    },
    transport: status.configured ? "redis" : "in-memory",
    message: !status.configured
      ? "Redis not configured - using in-memory fallback (single instance only)"
      : healthy
      ? "Redis pub/sub operational"
      : "Redis connection issues - events may be delayed",
  };

  return NextResponse.json(response, {
    status: healthy || !status.configured ? 200 : 503,
  });
}
