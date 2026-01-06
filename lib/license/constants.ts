import type { PlanId } from "@/lib/stripe/plans";

/**
 * License system constants
 * Single source of truth for all license-related constants
 */

/**
 * Plan code mapping for license key generation
 * Used in license key format: AUR-{PlanCode}-V2-...
 */
export const PLAN_CODES: Record<PlanId, string> = {
  basic: "BAS",
  professional: "PRO",
  enterprise: "ENT",
} as const;

/**
 * Reverse mapping: code to plan ID
 * Used for parsing and validating license keys
 */
export const CODE_TO_PLAN: Record<string, PlanId> = {
  BAS: "basic",
  PRO: "professional",
  ENT: "enterprise",
} as const;

/**
 * Current license key version
 * Increment when changing license key format
 */
export const LICENSE_VERSION = "V2";

/**
 * License key format regex
 * Format: AUR-{PlanCode}-V2-{Random8}-{Signature8}
 * Example: AUR-PRO-V2-7A83B2D4-1F2E3D4C
 */
export const LICENSE_KEY_FORMAT = /^AUR-[A-Z]{3}-V\d+-[A-Z0-9]{8}-[A-Z0-9]{8}$/;

/**
 * Deactivation limits
 * Maximum number of deactivations allowed per license key
 */
export const MAX_DEACTIVATIONS = 3;

/**
 * Heartbeat timeout
 * Maximum time (in milliseconds) before a terminal is considered offline
 */
export const HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

