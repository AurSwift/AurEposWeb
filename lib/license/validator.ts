import crypto from "crypto";
import { db } from "@/lib/db";
import { licenseKeys, activations, subscriptions, customers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// License key format: AUR-{PlanCode}-V{Version}-{Random8Char}-{Checksum}
const LICENSE_KEY_PATTERN = /^AUR-(BAS|PRO|ENT)-V[0-9]-[A-Z0-9]{8}-[A-Z0-9]{2}$/;

// Plan codes mapping
const PLAN_CODES: Record<string, string> = {
  BAS: "basic",
  PRO: "professional",
  ENT: "enterprise",
};

// Grace period for initial activation (24 hours) - allows rebinding within this window
const ACTIVATION_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

// Maximum deactivations per year (TODO: implement deactivation limits)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _MAX_DEACTIVATIONS_PER_YEAR = 3;

// Heartbeat validity period (7 days offline grace)
const OFFLINE_GRACE_PERIOD_DAYS = 7;

export interface ActivationRequest {
  licenseKey: string;
  machineIdHash: string;
  terminalName: string;
  appVersion: string;
  ipAddress?: string;
  location?: {
    city?: string;
    country?: string;
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

/**
 * Calculate checksum for license key validation
 */
function calculateChecksum(key: string): string {
  let sum = 0;
  for (let i = 0; i < key.length; i++) {
    sum += key.charCodeAt(i);
  }
  return (sum % 256).toString(16).toUpperCase().padStart(2, "0");
}

/**
 * Validate license key format and checksum
 */
export function validateLicenseKeyFormat(key: string): {
  valid: boolean;
  error?: string;
} {
  if (!key || typeof key !== "string") {
    return { valid: false, error: "License key is required" };
  }

  const normalizedKey = key.toUpperCase().trim();

  if (!LICENSE_KEY_PATTERN.test(normalizedKey)) {
    return {
      valid: false,
      error: "Invalid license key format. Expected format: AUR-XXX-V2-XXXXXXXX-XX",
    };
  }

  // Verify checksum
  const parts = normalizedKey.split("-");
  const checksumProvided = parts.pop()!;
  const baseKey = parts.join("-");
  const checksumCalculated = calculateChecksum(baseKey);

  if (checksumProvided !== checksumCalculated) {
    return { valid: false, error: "Invalid license key checksum" };
  }

  return { valid: true };
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

/**
 * Hash machine ID for storage (we never store raw machine IDs)
 */
export function hashMachineId(machineId: string): string {
  return crypto.createHash("sha256").update(machineId).digest("hex");
}

/**
 * Activate a license key for a specific machine
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

  // Step 2: Find license in database
  const [license] = await db
    .select()
    .from(licenseKeys)
    .where(eq(licenseKeys.licenseKey, normalizedKey))
    .limit(1);

  if (!license) {
    return {
      success: false,
      message: "License key not found. Please check your key and try again.",
    };
  }

  // Step 3: Check if license is active and not revoked
  if (!license.isActive) {
    return {
      success: false,
      message: "This license key has been deactivated. Please contact support.",
    };
  }

  if (license.revokedAt) {
    return {
      success: false,
      message: `This license key was revoked: ${license.revocationReason || "Contact support for details."}`,
    };
  }

  // Step 4: Check expiration
  if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
    return {
      success: false,
      message: "This license key has expired. Please renew your subscription.",
    };
  }

  // Step 5: Check subscription status
  let subscriptionStatus = "active";
  let businessName: string | null = null;

  if (license.subscriptionId) {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, license.subscriptionId))
      .limit(1);

    if (subscription) {
      subscriptionStatus = subscription.status || "active";

      if (subscriptionStatus === "cancelled" || subscriptionStatus === "past_due") {
        return {
          success: false,
          message: `Your subscription is ${subscriptionStatus}. Please update your payment method.`,
        };
      }
    }
  }

  // Get customer info for business name
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, license.customerId))
    .limit(1);

  if (customer) {
    businessName = customer.companyName;
  }

  // Step 6: Check existing activations for this license
  const existingActivations = await db
    .select()
    .from(activations)
    .where(
      and(
        eq(activations.licenseKey, normalizedKey),
        eq(activations.isActive, true)
      )
    );

  // Step 7: Check if this machine is already activated
  const existingMachineActivation = existingActivations.find(
    (a) => a.machineIdHash === machineIdHash
  );

  if (existingMachineActivation) {
    // Same machine - update heartbeat and return success
    await db
      .update(activations)
      .set({
        lastHeartbeat: new Date(),
        terminalName: terminalName || existingMachineActivation.terminalName,
      })
      .where(eq(activations.id, existingMachineActivation.id));

    const planId = extractPlanFromKey(normalizedKey) || "basic";

    return {
      success: true,
      message: "License already activated on this device. Validation updated.",
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

  // Step 8: Check max terminals limit
  if (existingActivations.length >= license.maxTerminals) {
    // Check if any activation is within grace period (can be replaced)
    const graceActivation = existingActivations.find((a) => {
      const firstActivation = new Date(a.firstActivation);
      return Date.now() - firstActivation.getTime() < ACTIVATION_GRACE_PERIOD_MS;
    });

    if (!graceActivation) {
      return {
        success: false,
        message: `Maximum terminal limit reached (${license.maxTerminals}). Deactivate another device first or upgrade your plan.`,
      };
    }

    // Deactivate the grace period activation to allow new one
    await db
      .update(activations)
      .set({ isActive: false })
      .where(eq(activations.id, graceActivation.id));
  }

  // Step 9: Create new activation
  const [newActivation] = await db
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

  // Step 10: Update activation count on license
  await db
    .update(licenseKeys)
    .set({
      activationCount: license.activationCount + 1,
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
}

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
      message: "License key is not active",
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

/**
 * Process heartbeat from desktop app
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

  if (license.subscriptionId) {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, license.subscriptionId))
      .limit(1);

    if (subscription) {
      subscriptionStatus = subscription.status || "active";

      if (subscriptionStatus === "cancelled") {
        // Check if past grace period
        const lastHeartbeat = activation.lastHeartbeat
          ? new Date(activation.lastHeartbeat)
          : new Date(activation.firstActivation);
        const gracePeriodEnd = new Date(
          lastHeartbeat.getTime() + OFFLINE_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
        );

        if (new Date() > gracePeriodEnd) {
          shouldDisable = true;
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
            ...(activation.location as object || {}),
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
      gracePeriodRemaining: shouldDisable
        ? 0
        : OFFLINE_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    },
  };
}

/**
 * Deactivate a license on a specific machine
 */
export async function deactivateLicense(
  licenseKey: string,
  machineIdHash: string
): Promise<{ success: boolean; message: string }> {
  const normalizedKey = licenseKey.toUpperCase().trim();

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

  await db
    .update(activations)
    .set({ isActive: false })
    .where(eq(activations.id, activation.id));

  return {
    success: true,
    message: "License deactivated successfully",
  };
}
