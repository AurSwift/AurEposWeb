import crypto from "crypto";
import { db } from "@/lib/db";
import { licenseKeys } from "@/lib/db/schema";
import type { PlanId } from "@/lib/stripe/plans";

const PLAN_CODES: Record<PlanId, string> = {
  basic: "BAS",
  professional: "PRO",
  enterprise: "ENT",
};

/**
 * Generate license key following business rules:
 * Format: AUR-{PlanCode}-V{Version}-{Random8Char}-{Checksum}
 * Example: AUR-PRO-V2-7A83B2D4-E9
 */
export function generateLicenseKey(planId: PlanId, customerId: string): string {
  const planCode = PLAN_CODES[planId];
  const version = "V2";

  // Generate unique 8-character random string (cryptographically secure)
  const uniquePart = crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()
    .substring(0, 8);

  // Create base key
  const baseKey = `AUR-${planCode}-${version}-${uniquePart}`;

  // Calculate checksum
  const checksum = calculateChecksum(baseKey);

  const licenseKey = `${baseKey}-${checksum}`;

  return licenseKey;
}

/**
 * Calculate checksum for license key validation
 */
function calculateChecksum(key: string): string {
  let sum = 0;
  for (let i = 0; i < key.length; i++) {
    sum += key.charCodeAt(i);
  }
  const checksum = (sum % 256).toString(16).toUpperCase().padStart(2, "0");
  return checksum;
}

/**
 * Validate license key format
 */
export function validateLicenseKeyFormat(key: string): boolean {
  const pattern = /^AUR-(BAS|PRO|ENT)-V[0-9]-[A-Z0-9]{8}-[A-Z0-9]{2}$/;
  return pattern.test(key);
}

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
      version: "2.0",
      issuedAt: new Date(),
      isActive: true,
    })
    .returning();

  return stored;
}
