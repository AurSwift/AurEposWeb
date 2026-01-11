/**
 * Terminal Coordination System
 * Phase 6: Multi-Terminal Coordination
 *
 * Manages coordination between multiple desktop terminals under the same license:
 * - Terminal session tracking
 * - State synchronization
 * - Broadcast events to all terminals
 * - Coordinated deactivation
 */

import { db } from "@/lib/db";
import {
  terminalSessions,
  terminalStateSync,
  terminalCoordinationEvents,
  type NewTerminalSession,
  type NewTerminalStateSync,
  type NewTerminalCoordinationEvent,
} from "@/lib/db/schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { publishGenericEvent } from "@/lib/subscription-events/redis-publisher";

/**
 * Terminal Info Interface
 */
export interface TerminalInfo {
  machineIdHash: string;
  terminalName?: string;
  hostname?: string;
  ipAddress?: string;
  appVersion?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Register Terminal Session
 * Called when a desktop terminal connects
 * Uses upsert pattern to prevent duplicates
 */
export async function registerTerminalSession(
  licenseKey: string,
  terminalInfo: TerminalInfo
): Promise<string> {
  const now = new Date();

  // First check if we need to determine isPrimary status
  // (only for new sessions when no active terminals exist)
  const activeTerminals = await db
    .select({ count: sql<number>`count(*)` })
    .from(terminalSessions)
    .where(
      and(
        eq(terminalSessions.licenseKey, licenseKey),
        eq(terminalSessions.connectionStatus, "connected")
      )
    );

  const isFirstTerminal = Number(activeTerminals[0]?.count || 0) === 0;

  // Prepare session data
  const sessionData: NewTerminalSession = {
    licenseKey,
    machineIdHash: terminalInfo.machineIdHash,
    terminalName: terminalInfo.terminalName,
    hostname: terminalInfo.hostname,
    ipAddress: terminalInfo.ipAddress,
    appVersion: terminalInfo.appVersion,
    connectionStatus: "connected",
    isPrimary: isFirstTerminal,
    metadata: terminalInfo.metadata,
  };

  // Use INSERT ... ON CONFLICT for atomic upsert
  // This prevents race conditions and duplicate entries
  const result = await db
    .insert(terminalSessions)
    .values(sessionData)
    .onConflictDoUpdate({
      target: [terminalSessions.machineIdHash, terminalSessions.licenseKey],
      set: {
        connectionStatus: "connected",
        lastConnectedAt: now,
        lastHeartbeatAt: now,
        appVersion: terminalInfo.appVersion,
        hostname: terminalInfo.hostname,
        ipAddress: terminalInfo.ipAddress,
        metadata: terminalInfo.metadata,
        // Don't update terminalName, firstConnectedAt, or isPrimary on reconnection
      },
    })
    .returning();

  const session = result[0];
  const isReconnection = session.firstConnectedAt < now;

  // Publish appropriate event
  if (isReconnection) {
    publishGenericEvent(licenseKey, "terminal_reconnected", {
      machineIdHash: terminalInfo.machineIdHash,
      terminalName: session.terminalName,
    });
  } else {
    publishGenericEvent(licenseKey, "terminal_added", {
      machineIdHash: terminalInfo.machineIdHash,
      terminalName: terminalInfo.terminalName,
      isPrimary: isFirstTerminal,
    });
  }

  return session.id;
}

/**
 * Update Terminal Heartbeat
 * Called periodically to keep session alive
 */
export async function updateTerminalHeartbeat(
  licenseKey: string,
  machineIdHash: string
): Promise<void> {
  await db
    .update(terminalSessions)
    .set({
      lastHeartbeatAt: new Date(),
      connectionStatus: "connected",
    })
    .where(
      and(
        eq(terminalSessions.licenseKey, licenseKey),
        eq(terminalSessions.machineIdHash, machineIdHash)
      )
    );
}

/**
 * Disconnect Terminal Session
 * Called when terminal disconnects or closes
 */
export async function disconnectTerminalSession(
  licenseKey: string,
  machineIdHash: string
): Promise<void> {
  const session = await db
    .select()
    .from(terminalSessions)
    .where(
      and(
        eq(terminalSessions.licenseKey, licenseKey),
        eq(terminalSessions.machineIdHash, machineIdHash)
      )
    )
    .limit(1);

  if (session.length === 0) return;

  await db
    .update(terminalSessions)
    .set({
      connectionStatus: "disconnected",
      disconnectedAt: new Date(),
    })
    .where(eq(terminalSessions.id, session[0].id));

  // If this was the primary terminal, promote another
  if (session[0].isPrimary) {
    await promoteNewPrimaryTerminal(licenseKey);
  }

  publishGenericEvent(licenseKey, "terminal_removed", {
    machineIdHash,
    terminalName: session[0].terminalName,
  });
}

/**
 * Deactivate All Terminals for License
 * Called when license is deactivated or cancelled
 */
export async function deactivateAllTerminals(
  licenseKey: string
): Promise<void> {
  // Update all sessions to deactivated
  await db
    .update(terminalSessions)
    .set({
      connectionStatus: "deactivated",
      deactivatedAt: new Date(),
    })
    .where(eq(terminalSessions.licenseKey, licenseKey));

  // Broadcast deactivation event to all terminals
  publishGenericEvent(licenseKey, "deactivation_broadcast" as any, {
    reason: "license_deactivated",
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get Active Terminals for License
 */
export async function getActiveTerminals(licenseKey: string) {
  return await db
    .select()
    .from(terminalSessions)
    .where(
      and(
        eq(terminalSessions.licenseKey, licenseKey),
        eq(terminalSessions.connectionStatus, "connected")
      )
    )
    .orderBy(desc(terminalSessions.lastHeartbeatAt));
}

/**
 * Get All Terminals for License (including disconnected)
 */
export async function getAllTerminals(licenseKey: string) {
  return await db
    .select()
    .from(terminalSessions)
    .where(eq(terminalSessions.licenseKey, licenseKey))
    .orderBy(desc(terminalSessions.lastConnectedAt));
}

/**
 * Broadcast Event to All Terminals
 */
export async function broadcastToAllTerminals(
  licenseKey: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  const terminals = await getActiveTerminals(licenseKey);

  // Create coordination event
  const event: NewTerminalCoordinationEvent = {
    licenseKey,
    eventType,
    payload,
    isBroadcast: true,
    deliveryStatus: terminals.reduce(
      (acc, t) => ({
        ...acc,
        [t.machineIdHash]: "pending",
      }),
      {}
    ),
  };

  await db.insert(terminalCoordinationEvents).values(event);

  // Publish via SSE to all terminals
  publishGenericEvent(licenseKey, eventType as any, payload);
}

/**
 * Synchronize State Across Terminals
 */
export async function synchronizeTerminalState(
  licenseKey: string,
  syncType: string,
  sourceMachineIdHash: string | null,
  payload: Record<string, unknown>,
  targetMachineIdHashes?: string[]
): Promise<string> {
  const sync: NewTerminalStateSync = {
    licenseKey,
    syncType,
    sourceMachineIdHash,
    targetMachineIdHashes: targetMachineIdHashes || null,
    payload,
    syncStatus: "pending",
  };

  const result = await db.insert(terminalStateSync).values(sync).returning();

  // Broadcast sync event
  publishGenericEvent(licenseKey, "state_sync", {
    syncId: result[0].id,
    syncType,
    payload,
    targetMachines: targetMachineIdHashes || "all",
  });

  return result[0].id;
}

/**
 * Acknowledge State Sync
 */
export async function acknowledgeStateSync(
  syncId: string,
  machineIdHash: string
): Promise<void> {
  const sync = await db
    .select()
    .from(terminalStateSync)
    .where(eq(terminalStateSync.id, syncId))
    .limit(1);

  if (sync.length === 0) return;

  const acknowledgedBy = (sync[0].acknowledgedBy as string[]) || [];
  acknowledgedBy.push(machineIdHash);

  await db
    .update(terminalStateSync)
    .set({
      acknowledgedBy,
    })
    .where(eq(terminalStateSync.id, syncId));

  // Check if all targets acknowledged
  const targetMachines = sync[0].targetMachineIdHashes as string[] | null;
  if (targetMachines && acknowledgedBy.length >= targetMachines.length) {
    await db
      .update(terminalStateSync)
      .set({
        syncStatus: "completed",
        completedAt: new Date(),
      })
      .where(eq(terminalStateSync.id, syncId));
  }
}

/**
 * Promote New Primary Terminal
 */
async function promoteNewPrimaryTerminal(licenseKey: string): Promise<void> {
  // Get the oldest active terminal
  const activeTerminals = await getActiveTerminals(licenseKey);

  if (activeTerminals.length === 0) return;

  const newPrimary = activeTerminals[0];

  // Set as primary
  await db
    .update(terminalSessions)
    .set({
      isPrimary: true,
    })
    .where(eq(terminalSessions.id, newPrimary.id));

  // Publish primary changed event
  publishGenericEvent(licenseKey, "primary_changed", {
    newPrimaryMachineIdHash: newPrimary.machineIdHash,
    terminalName: newPrimary.terminalName,
  });
}

/**
 * Publish Terminal Event
 */
async function publishTerminalEvent(
  licenseKey: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  const event: NewTerminalCoordinationEvent = {
    licenseKey,
    eventType,
    payload,
    isBroadcast: true,
  };

  await db.insert(terminalCoordinationEvents).values(event);

  // Also publish via SSE
  publishGenericEvent(licenseKey, eventType as any, payload);
}

/**
 * Detect Stale Sessions
 * Find sessions with no heartbeat in last 5 minutes
 */
export async function detectStaleSessions(): Promise<void> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const staleSessions = await db
    .select()
    .from(terminalSessions)
    .where(
      and(
        eq(terminalSessions.connectionStatus, "connected"),
        sql`${
          terminalSessions.lastHeartbeatAt
        } < ${fiveMinutesAgo.toISOString()}`
      )
    );

  for (const session of staleSessions) {
    await disconnectTerminalSession(session.licenseKey, session.machineIdHash);
  }
}

/**
 * Get Terminal Session Statistics
 */
export async function getTerminalStats(licenseKey?: string) {
  const whereConditions = licenseKey
    ? [eq(terminalSessions.licenseKey, licenseKey)]
    : [];

  const stats = await db
    .select({
      totalSessions: sql<number>`count(*)`,
      activeSessions: sql<number>`count(*) filter (where connection_status = 'connected')`,
      disconnectedSessions: sql<number>`count(*) filter (where connection_status = 'disconnected')`,
      deactivatedSessions: sql<number>`count(*) filter (where connection_status = 'deactivated')`,
      uniqueLicenses: sql<number>`count(distinct license_key)`,
    })
    .from(terminalSessions)
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

  return stats[0];
}
