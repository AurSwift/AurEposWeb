import { db } from "@/lib/db";
import { licenseKeys } from "@/lib/db/schema";
import type { PlanId } from "@/lib/stripe/plans";
import {
  calculateHmacSignature,
  generateSecureRandom,
} from "./crypto";
import { PLAN_CODES, LICENSE_VERSION } from "./constants";
import { timingSafeEqual } from "crypto";

// ============================================================================
// LICENSE KEY GENERATION
// ============================================================================

/**
 * Generate license key with HMAC signature
 * Format: AUR-{PlanCode}-V2-{Random8Char}-{HMACSignature8Char}
 * Example: AUR-PRO-V2-7A83B2D4-1F2E3D4C
 */
export function generateLicenseKey(planId: PlanId, customerId: string): string {
  const planCode = PLAN_CODES[planId];

  // Generate unique 8-character random string (cryptographically secure)
  const uniquePart = generateSecureRandom(8);

  // Create base key (without signature)
  const baseKey = `AUR-${planCode}-${LICENSE_VERSION}-${uniquePart}`;

  // Calculate HMAC signature (includes customerId for tamper protection)
  const signature = calculateHmacSignature(baseKey, customerId);

  return `${baseKey}-${signature}`;
}

/**
 * Verify HMAC signature for a license key
 * Returns true if signature is valid for the given customerId
 */
export function verifyLicenseSignature(
  licenseKey: string,
  customerId: string
): boolean {
  try {
    const parts = licenseKey.toUpperCase().trim().split("-");
    if (parts.length !== 5) return false;

    const signatureProvided = parts[4];
    const baseKey = parts.slice(0, 4).join("-");

    const signatureExpected = calculateHmacSignature(baseKey, customerId);

    // Constant-time comparison to prevent timing attacks
    if (signatureProvided.length !== signatureExpected.length) return false;

    return timingSafeEqual(
      Buffer.from(signatureProvided),
      Buffer.from(signatureExpected)
    );
  } catch {
    return false;
  }
}

// ============================================================================
// VALIDATION
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

  // V2 format: AUR-XXX-V2-XXXXXXXX-XXXXXXXX (8 char signature)
  const v2Pattern = /^AUR-(BAS|PRO|ENT)-V2-[A-Z0-9]{8}-[A-Z0-9]{8}$/;
  if (v2Pattern.test(normalizedKey)) {
    return { valid: true };
  }

  return { valid: false, error: "Invalid license key format" };
}

/**
 * Extract plan ID from license key
 */
export function extractPlanFromKey(key: string): PlanId | null {
  const match = key.toUpperCase().match(/^AUR-(BAS|PRO|ENT)-/);
  if (!match) return null;

  const codeToId: Record<string, PlanId> = {
    BAS: "basic",
    PRO: "professional",
  };

  return codeToId[match[1]] || null;
}

/**
 * Mask license key for display/logging (security)
 */
export function maskLicenseKey(key: string): string {
  if (!key || key.length < 15) return "INVALID_KEY";
  // Show: AUR-XXX-V2-****-****
  return `${key.substring(0, 11)}****-****`;
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Store license key in database
 */
export async function storeLicenseKey(
  licenseKey: string,
  customerId: string,
  subscriptionId: string,
  planId: PlanId,
  maxTerminals: number
) {
  const [stored] = await db
    .insert(licenseKeys)
    .values({
      customerId,
      subscriptionId,
      licenseKey,
      maxTerminals,
      version: LICENSE_VERSION,
      issuedAt: new Date(),
      isActive: true,
    })
    .returning();

  return stored;
}
