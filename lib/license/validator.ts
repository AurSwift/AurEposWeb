import crypto from "crypto";
import { db } from "@/lib/db";
import {
  licenseKeys,
  activations,
  subscriptions,
  customers,
} from "@/lib/db/schema";
import { eq, and, sql, count } from "drizzle-orm";
import {
  CODE_TO_PLAN,
  LICENSE_KEY_FORMAT,
  MAX_DEACTIVATIONS,
  HEARTBEAT_TIMEOUT_MS,
} from "./constants";

// ============================================================================
// CONFIGURATION
// ============================================================================

// License key format (from constants)
const LICENSE_KEY_PATTERN = LICENSE_KEY_FORMAT;

// HMAC secret for license key validation (must be set in environment)
const LICENSE_HMAC_SECRET = process.env.LICENSE_HMAC_SECRET;

// Plan codes mapping (from constants)
const PLAN_CODES = CODE_TO_PLAN;

// Grace period for initial activation (24 hours) - allows rebinding within this window
const ACTIVATION_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

// Maximum deactivations per year
const MAX_DEACTIVATIONS_PER_YEAR = 3;

// Heartbeat validity period (7 days offline grace)
const OFFLINE_GRACE_PERIOD_DAYS = 7;

// ============================================================================
// TYPES
// ============================================================================

export interface ActivationRequest {
  licenseKey: string;
  machineIdHash: string;
  terminalName: string;
  appVersion: string;
  ipAddress?: string;
  location?: {
    city?: string;
    country?: string;
    platform?: string;
    arch?: string;
  };
}

export interface ActivationResult {
  success: boolean;
  message: string;
  data?: {
    activationId: string;
    planId: string;
    planName: string;
    maxTerminals: number;
    currentActivations: number;
    features: string[];
    expiresAt: string | null;
    subscriptionStatus: string;
    businessName: string | null;
  };
}

export interface ValidationResult {
  success: boolean;
  message: string;
  data?: {
    isValid: boolean;
    planId: string;
    planName: string;
    features: string[];
    subscriptionStatus: string;
    expiresAt: string | null;
    daysUntilExpiry: number | null;
  };
}

export interface HeartbeatResult {
  success: boolean;
  message: string;
  data?: {
    isValid: boolean;
    planId: string;
    subscriptionStatus: string;
    shouldDisable: boolean;
    gracePeriodRemaining: number | null;
  };
}

export interface DeactivationResult {
  success: boolean;
  message: string;
  remainingDeactivations?: number;
}

// ============================================================================
// CRYPTOGRAPHIC FUNCTIONS
// ============================================================================

// Import shared cryptographic functions
import { calculateHmacSignature, hashMachineId } from "./crypto";

// Export hashMachineId for external use
export { hashMachineId };

/**
 * Mask license key for logging (security)
 */
export function maskLicenseKey(key: string): string {
  if (!key || key.length < 15) return "INVALID_KEY";
  // Show only first 8 and last 4 characters: AUR-XXX-V2-****-****
  return `${key.substring(0, 11)}****-****`;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate license key format
 */
export function validateLicenseKeyFormat(key: string): {
  valid: boolean;
  error?: string;
} {
  if (!key || typeof key !== "string") {
    return { valid: false, error: "License key is required" };
  }

  const normalizedKey = key.toUpperCase().trim();

  if (LICENSE_KEY_PATTERN.test(normalizedKey)) {
    return { valid: true };
  }

  return {
    valid: false,
    error:
      "Invalid license key format. Expected format: AUR-XXX-V2-XXXXXXXX-XXXXXXXX",
  };
}

/**
 * Verify HMAC signature for V2 license keys
 * Requires database lookup to get customerId
 */
export async function verifyLicenseSignature(
  licenseKey: string,
  customerId: string
): Promise<boolean> {
  const parts = licenseKey.toUpperCase().trim().split("-");
  const signatureProvided = parts.pop()!;
  const baseKey = parts.join("-");

  const signatureExpected = calculateHmacSignature(baseKey, customerId);

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signatureProvided),
    Buffer.from(signatureExpected)
  );
}

/**
 * Extract plan code from license key
 */
export function extractPlanFromKey(key: string): string | null {
  const match = key.match(/^AUR-(BAS|PRO|ENT)-/);
  if (!match) return null;
  return PLAN_CODES[match[1]] || null;
}

/**
 * Get features based on plan
 */
export function getPlanFeatures(planId: string): string[] {
  const features: Record<string, string[]> = {
    basic: [
      "single_terminal",
      "basic_reporting",
      "product_management",
      "sales_processing",
      "receipt_printing",
    ],
    professional: [
      "multi_terminal",
      "advanced_reporting",
      "product_management",
      "sales_processing",
      "receipt_printing",
      "inventory_management",
      "employee_management",
      "batch_tracking",
      "expiry_tracking",
    ],
    enterprise: [
      "unlimited_terminals",
      "enterprise_reporting",
      "product_management",
      "sales_processing",
      "receipt_printing",
      "inventory_management",
      "employee_management",
      "batch_tracking",
      "expiry_tracking",
      "multi_location",
      "api_access",
      "priority_support",
      "custom_integrations",
    ],
  };

  return features[planId] || features.basic;
}

// ============================================================================
// LICENSE ACTIVATION (with Transaction & Row Locking)
// ============================================================================

/**
 * Activate a license key for a specific machine
 * Uses database transaction with row locking to prevent race conditions
 */
export async function activateLicense(
  request: ActivationRequest
): Promise<ActivationResult> {
  const { licenseKey, machineIdHash, terminalName, ipAddress, location } =
    request;

  // Step 1: Validate license key format
  const formatValidation = validateLicenseKeyFormat(licenseKey);
  if (!formatValidation.valid) {
    return {
      success: false,
      message: formatValidation.error || "Invalid license key format",
    };
  }

  const normalizedKey = licenseKey.toUpperCase().trim();

  // Use database transaction with row locking to prevent race conditions
  try {
    return await db.transaction(async (tx) => {
      // Step 2: Find and LOCK license row (SELECT ... FOR UPDATE)
      const [license] = await tx
        .select()
        .from(licenseKeys)
        .where(eq(licenseKeys.licenseKey, normalizedKey))
        .for("update") // Row-level lock
        .limit(1);

      if (!license) {
        return {
          success: false,
          message:
            "License key not found. Please check your key and try again.",
        };
      }

      // Step 3: Check if license is active and not revoked
      if (!license.isActive) {
        return {
          success: false,
          message:
            "This license key has been deactivated. Please contact support.",
        };
      }

      if (license.revokedAt) {
        return {
          success: false,
          message: `This license key was revoked: ${
            license.revocationReason || "Contact support for details."
          }`,
        };
      }

      // Step 4: Check expiration
      if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
        return {
          success: false,
          message:
            "This license key has expired. Please renew your subscription.",
        };
      }

      // Step 5: Check subscription status
      let subscriptionStatus = "active";
      let businessName: string | null = null;
      if (license.subscriptionId) {
        const [subscription] = await tx
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, license.subscriptionId))
          .limit(1);

        if (subscription) {
          subscriptionStatus = subscription.status || "active";

          // Allow trialing subscriptions
          if (subscriptionStatus === "trialing") {
            subscriptionStatus = "active";
          }

          if (
            subscriptionStatus === "cancelled" ||
            subscriptionStatus === "past_due"
          ) {
            return {
              success: false,
              message: `Your subscription is ${subscriptionStatus}. Please update your payment method.`,
            };
          }
        }
      }

      // Get customer info for business name
      const [customer] = await tx
        .select()
        .from(customers)
        .where(eq(customers.id, license.customerId))
        .limit(1);

      if (customer) {
        businessName = customer.companyName;
      }

      // Step 6: Get existing activations with lock
      const existingActivations = await tx
        .select()
        .from(activations)
        .where(
          and(
            eq(activations.licenseKey, normalizedKey),
            eq(activations.isActive, true)
          )
        )
        .for("update"); // Lock activation rows too

      // Step 7: Check if this machine is already activated
      const existingMachineActivation = existingActivations.find(
        (a) => a.machineIdHash === machineIdHash
      );

      if (existingMachineActivation) {
        // Same machine - update heartbeat and return success
        await tx
          .update(activations)
          .set({
            lastHeartbeat: new Date(),
            terminalName:
              terminalName || existingMachineActivation.terminalName,
            location: location || existingMachineActivation.location,
          })
          .where(eq(activations.id, existingMachineActivation.id));

        const planId = extractPlanFromKey(normalizedKey) || "basic";

        return {
          success: true,
          message:
            "License already activated on this device. Validation updated.",
          data: {
            activationId: existingMachineActivation.id,
            planId,
            planName: planId.charAt(0).toUpperCase() + planId.slice(1),
            maxTerminals: license.maxTerminals,
            currentActivations: existingActivations.length,
            features: getPlanFeatures(planId),
            expiresAt: license.expiresAt?.toISOString() || null,
            subscriptionStatus,
            businessName,
          },
        };
      }

      // Step 8: Check max terminals limit (atomic with transaction)
      if (existingActivations.length >= license.maxTerminals) {
        // Check if any activation is within grace period (can be replaced)
        const graceActivation = existingActivations.find((a) => {
          const firstActivation = new Date(a.firstActivation);
          return (
            Date.now() - firstActivation.getTime() < ACTIVATION_GRACE_PERIOD_MS
          );
        });

        if (!graceActivation) {
          return {
            success: false,
            message: `Maximum terminal limit reached (${license.maxTerminals}). Deactivate another device first or upgrade your plan.`,
          };
        }

        // Deactivate the grace period activation to allow new one
        await tx
          .update(activations)
          .set({ isActive: false })
          .where(eq(activations.id, graceActivation.id));
      }

      // Step 9: Create new activation
      const [newActivation] = await tx
        .insert(activations)
        .values({
          licenseKey: normalizedKey,
          machineIdHash,
          terminalName: terminalName || "Terminal",
          firstActivation: new Date(),
          lastHeartbeat: new Date(),
          isActive: true,
          ipAddress: ipAddress || null,
          location: location || null,
        })
        .returning();

      // Step 10: Update activation count ATOMICALLY using SQL increment
      await tx
        .update(licenseKeys)
        .set({
          activationCount: sql`${licenseKeys.activationCount} + 1`,
        })
        .where(eq(licenseKeys.id, license.id));

      const planId = extractPlanFromKey(normalizedKey) || "basic";

      return {
        success: true,
        message: "License activated successfully!",
        data: {
          activationId: newActivation.id,
          planId,
          planName: planId.charAt(0).toUpperCase() + planId.slice(1),
          maxTerminals: license.maxTerminals,
          currentActivations: existingActivations.length + 1,
          features: getPlanFeatures(planId),
          expiresAt: license.expiresAt?.toISOString() || null,
          subscriptionStatus,
          businessName,
        },
      };
    });
  } catch (error) {
    console.error("License activation transaction failed:", error);
    return {
      success: false,
      message: "Activation failed due to a server error. Please try again.",
    };
  }
}

// ============================================================================
// VALIDATE LICENSE
// ============================================================================

/**
 * Validate a license key without activating
 */
export async function validateLicense(
  licenseKey: string,
  machineIdHash?: string
): Promise<ValidationResult> {
  // Step 1: Validate format
  const formatValidation = validateLicenseKeyFormat(licenseKey);
  if (!formatValidation.valid) {
    return {
      success: false,
      message: formatValidation.error || "Invalid license key format",
    };
  }

  const normalizedKey = licenseKey.toUpperCase().trim();

  // Step 2: Find license in database
  const [license] = await db
    .select()
    .from(licenseKeys)
    .where(eq(licenseKeys.licenseKey, normalizedKey))
    .limit(1);

  if (!license) {
    return {
      success: false,
      message: "License key not found",
    };
  }

  // Step 3: Check status
  if (!license.isActive || license.revokedAt) {
    return {
      success: false,
      message: `License key has been revoked${license.revocationReason ? `: ${license.revocationReason}` : ""}`,
    };
  }

  // Step 4: Check subscription if linked
  let subscriptionStatus = "active";
  if (license.subscriptionId) {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, license.subscriptionId))
      .limit(1);

    if (subscription) {
      subscriptionStatus = subscription.status || "active";

      // Trialing is considered active
      if (subscriptionStatus === "trialing") {
        subscriptionStatus = "active";
      }
    }
  }

  // Step 5: Calculate expiry info
  let daysUntilExpiry: number | null = null;
  if (license.expiresAt) {
    const expiresAt = new Date(license.expiresAt);
    const now = new Date();
    daysUntilExpiry = Math.ceil(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // Step 6: Check if machine is activated (if machineIdHash provided)
  if (machineIdHash) {
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
      return {
        success: false,
        message: "License not activated on this device",
      };
    }
  }

  const planId = extractPlanFromKey(normalizedKey) || "basic";

  return {
    success: true,
    message: "License is valid",
    data: {
      isValid: true,
      planId,
      planName: planId.charAt(0).toUpperCase() + planId.slice(1),
      features: getPlanFeatures(planId),
      subscriptionStatus,
      expiresAt: license.expiresAt?.toISOString() || null,
      daysUntilExpiry,
    },
  };
}

// ============================================================================
// HEARTBEAT (with Fixed Grace Period Calculation)
// ============================================================================

/**
 * Process heartbeat from desktop app
 * Grace period is now calculated from subscription cancellation date, not last heartbeat
 */
export async function processHeartbeat(
  licenseKey: string,
  machineIdHash: string,
  metadata?: {
    appVersion?: string;
    sessionCount?: number;
    transactionCount?: number;
  }
): Promise<HeartbeatResult> {
  const normalizedKey = licenseKey.toUpperCase().trim();

  // Find the activation
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
    return {
      success: false,
      message: "No active activation found for this device",
      data: {
        isValid: false,
        planId: "",
        subscriptionStatus: "unknown",
        shouldDisable: true,
        gracePeriodRemaining: null,
      },
    };
  }

  // Find the license
  const [license] = await db
    .select()
    .from(licenseKeys)
    .where(eq(licenseKeys.licenseKey, normalizedKey))
    .limit(1);

  if (!license || !license.isActive || license.revokedAt) {
    return {
      success: false,
      message: "License is no longer valid",
      data: {
        isValid: false,
        planId: "",
        subscriptionStatus: "revoked",
        shouldDisable: true,
        gracePeriodRemaining: null,
      },
    };
  }

  // Check subscription status
  let subscriptionStatus = "active";
  let shouldDisable = false;
  let gracePeriodRemaining: number | null =
    OFFLINE_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

  if (license.subscriptionId) {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, license.subscriptionId))
      .limit(1);

    if (subscription) {
      subscriptionStatus = subscription.status || "active";
      const now = new Date();

      // Check if currently in trial period
      const isInTrial =
        subscriptionStatus === "trialing" &&
        subscription.trialEnd &&
        subscription.trialEnd > now;

      if (subscriptionStatus === "cancelled") {
        // TRIAL CANCELLATION: If cancelled during trial, allow access until trial end
        if (isInTrial && subscription.trialEnd) {
          const trialGracePeriodEnd = new Date(
            subscription.trialEnd.getTime() +
              OFFLINE_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
          );

          if (now > trialGracePeriodEnd) {
            shouldDisable = true;
            gracePeriodRemaining = 0;
          } else {
            gracePeriodRemaining =
              trialGracePeriodEnd.getTime() - now.getTime();
          }
        } else {
          // PAID SUBSCRIPTION CANCELLATION: Use normal grace period from cancellation date
          const cancellationDate = subscription.canceledAt
            ? new Date(subscription.canceledAt)
            : new Date();

          const gracePeriodEnd = new Date(
            cancellationDate.getTime() +
              OFFLINE_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
          );

          if (now > gracePeriodEnd) {
            shouldDisable = true;
            gracePeriodRemaining = 0;
          } else {
            gracePeriodRemaining = gracePeriodEnd.getTime() - now.getTime();
          }
        }
      } else if (subscriptionStatus === "trialing") {
        // TRIAL PERIOD: Check if trial has expired
        if (subscription.trialEnd && now > subscription.trialEnd) {
          // Trial ended - apply grace period
          const trialGracePeriodEnd = new Date(
            subscription.trialEnd.getTime() +
              OFFLINE_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
          );

          if (now > trialGracePeriodEnd) {
            shouldDisable = true;
            gracePeriodRemaining = 0;
          } else {
            gracePeriodRemaining =
              trialGracePeriodEnd.getTime() - now.getTime();
          }
        }
      } else if (subscriptionStatus === "past_due") {
        // PAST DUE: Shorter grace period (3 days) for payment failures
        const lastPaymentAttempt = subscription.currentPeriodEnd
          ? new Date(subscription.currentPeriodEnd)
          : new Date();

        const pastDueGracePeriodEnd = new Date(
          lastPaymentAttempt.getTime() + 3 * 24 * 60 * 60 * 1000
        );

        if (now > pastDueGracePeriodEnd) {
          shouldDisable = true;
          gracePeriodRemaining = 0;
        } else {
          gracePeriodRemaining =
            pastDueGracePeriodEnd.getTime() - now.getTime();
        }
      }
    }
  }

  // Update heartbeat
  await db
    .update(activations)
    .set({
      lastHeartbeat: new Date(),
      location: metadata
        ? {
            ...((activation.location as object) || {}),
            lastMetadata: metadata,
          }
        : activation.location,
    })
    .where(eq(activations.id, activation.id));

  const planId = extractPlanFromKey(normalizedKey) || "basic";

  return {
    success: true,
    message: "Heartbeat recorded",
    data: {
      isValid: !shouldDisable,
      planId,
      subscriptionStatus,
      shouldDisable,
      gracePeriodRemaining,
    },
  };
}

// ============================================================================
// DEACTIVATION (with Rate Limiting)
// ============================================================================

/**
 * Track deactivation count per license per year
 */
async function getDeactivationCountThisYear(
  licenseKey: string
): Promise<number> {
  const startOfYear = new Date();
  startOfYear.setMonth(0, 1);
  startOfYear.setHours(0, 0, 0, 0);

  // Count deactivations this year by checking inactive activations
  const result = await db
    .select({ count: count() })
    .from(activations)
    .where(
      and(
        eq(activations.licenseKey, licenseKey),
        eq(activations.isActive, false)
      )
    );

  return result[0]?.count || 0;
}

/**
 * Deactivate a license on a specific machine
 * Implements deactivation limits to prevent abuse
 */
export async function deactivateLicense(
  licenseKey: string,
  machineIdHash: string
): Promise<DeactivationResult> {
  const normalizedKey = licenseKey.toUpperCase().trim();

  // Check deactivation limit
  const deactivationsThisYear = await getDeactivationCountThisYear(
    normalizedKey
  );

  if (deactivationsThisYear >= MAX_DEACTIVATIONS_PER_YEAR) {
    return {
      success: false,
      message: `Maximum deactivations reached (${MAX_DEACTIVATIONS_PER_YEAR}/year). Please contact support.`,
      remainingDeactivations: 0,
    };
  }

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
    return {
      success: false,
      message: "No active activation found for this device",
    };
  }

  // Deactivate with timestamp for tracking
  await db
    .update(activations)
    .set({
      isActive: false,
      // Store deactivation time in location metadata
      location: {
        ...((activation.location as object) || {}),
        deactivatedAt: new Date().toISOString(),
      },
    })
    .where(eq(activations.id, activation.id));

  return {
    success: true,
    message: "License deactivated successfully",
    remainingDeactivations:
      MAX_DEACTIVATIONS_PER_YEAR - deactivationsThisYear - 1,
  };
}
