import crypto from "crypto";

/**
 * Cryptographic utilities for license key operations
 * Centralizes all cryptographic functions for consistency and security
 */

const LICENSE_HMAC_SECRET = process.env.LICENSE_HMAC_SECRET;

/**
 * Calculate HMAC signature for license key validation
 * This provides cryptographic integrity verification for license keys
 * 
 * @param baseKey - The base license key string
 * @param customerId - Customer ID for binding license to customer
 * @returns 8-character uppercase HMAC signature
 * @throws Error if LICENSE_HMAC_SECRET is not configured
 * 
 * @example
 * const signature = calculateHmacSignature("AUR-PRO-V2-7A83B2D4", "cust_123");
 * // Returns: "1F2E3D4C"
 */
export function calculateHmacSignature(
  baseKey: string,
  customerId: string
): string {
  if (!LICENSE_HMAC_SECRET) {
    throw new Error("LICENSE_HMAC_SECRET environment variable is required");
  }

  return crypto
    .createHmac("sha256", LICENSE_HMAC_SECRET)
    .update(`${baseKey}-${customerId}`)
    .digest("hex")
    .substring(0, 8)
    .toUpperCase();
}

/**
 * Hash machine ID for storage
 * We never store raw machine IDs for privacy and security
 * 
 * @param machineId - Raw machine identifier
 * @returns SHA-256 hash of machine ID
 * 
 * @example
 * const hash = hashMachineId("machine-abc-123");
 * // Returns: "a1b2c3d4..."
 */
export function hashMachineId(machineId: string): string {
  return crypto.createHash("sha256").update(machineId).digest("hex");
}

/**
 * Generate cryptographically secure random string
 * 
 * @param length - Length of random string to generate
 * @returns Uppercase alphanumeric random string
 * 
 * @example
 * const random = generateSecureRandom(8);
 * // Returns: "7A83B2D4"
 */
export function generateSecureRandom(length: number): string {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .substring(0, length)
    .toUpperCase();
}

