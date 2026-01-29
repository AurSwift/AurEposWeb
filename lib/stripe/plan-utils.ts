import type { PlanId } from "./plans";

/**
 * Plan display name mapping
 * Single source of truth for plan names across the application
 */
const PLAN_DISPLAY_NAMES: Record<PlanId, string> = {
  basic: "Basic Plan",
  professional: "Professional Plan",
} as const;

/**
 * Short plan name mapping (for compact displays)
 */
const PLAN_SHORT_NAMES: Record<PlanId, string> = {
  basic: "Basic",
  professional: "Pro",
} as const;

/**
 * Plan code mapping (for license keys)
 */
export const PLAN_CODES: Record<PlanId, string> = {
  basic: "BAS",
  professional: "PRO",
} as const;

/**
 * Reverse mapping: code to plan ID
 */
export const CODE_TO_PLAN: Record<string, PlanId> = {
  BAS: "basic",
  PRO: "professional",
} as const;

/**
 * Get display name for a plan
 *
 * @param planId - Plan identifier
 * @returns Full display name (e.g., "Professional Plan")
 *
 * @example
 * const name = getPlanDisplayName("professional");
 * // Returns: "Professional Plan"
 */
export function getPlanDisplayName(planId: PlanId | string): string {
  if (isValidPlanId(planId)) {
    return PLAN_DISPLAY_NAMES[planId];
  }
  return "Unknown Plan";
}

/**
 * Get short name for a plan
 *
 * @param planId - Plan identifier
 * @returns Short display name (e.g., "Pro")
 *
 * @example
 * const name = getShortPlanName("professional");
 * // Returns: "Pro"
 */
export function getShortPlanName(planId: PlanId | string): string {
  if (isValidPlanId(planId)) {
    return PLAN_SHORT_NAMES[planId];
  }
  return "Unknown";
}

/**
 * Get plan code for license key generation
 *
 * @param planId - Plan identifier
 * @returns Plan code (e.g., "PRO")
 */
export function getPlanCode(planId: PlanId): string {
  return PLAN_CODES[planId];
}

/**
 * Get plan ID from code
 *
 * @param code - Plan code (e.g., "PRO")
 * @returns Plan ID or null if invalid
 */
export function getPlanIdFromCode(code: string): PlanId | null {
  return CODE_TO_PLAN[code.toUpperCase()] || null;
}

/**
 * Capitalize plan ID for display
 *
 * @param planId - Plan identifier
 * @returns Capitalized plan name (e.g., "Professional")
 *
 * @example
 * const name = capitalizePlanId("professional");
 * // Returns: "Professional"
 */
export function capitalizePlanId(planId: string): string {
  if (!planId) return "";
  return planId.charAt(0).toUpperCase() + planId.slice(1);
}

/**
 * Type guard to validate plan IDs
 *
 * @param id - Value to check
 * @returns True if valid plan ID
 */
export function isValidPlanId(id: unknown): id is PlanId {
  return (
    typeof id === "string" &&
    ["basic", "professional"].includes(id)
  );
}

/**
 * Get plan tier level (for comparison)
 *
 * @param planId - Plan identifier
 * @returns Numeric tier level (1-3)
 */
export function getPlanTier(planId: PlanId): number {
  const tiers: Record<PlanId, number> = {
    basic: 1,
    professional: 2,
  };
  return tiers[planId];
}

/**
 * Compare two plans
 *
 * @param planA - First plan to compare
 * @param planB - Second plan to compare
 * @returns Positive if planA > planB, negative if planA < planB, 0 if equal
 *
 * @example
 * if (comparePlans("professional", "basic") > 0) {
 *   console.log("Professional is higher tier than Basic");
 * }
 */
export function comparePlans(planA: PlanId, planB: PlanId): number {
  return getPlanTier(planA) - getPlanTier(planB);
}

/**
 * Check if plan is an upgrade
 *
 * @param fromPlan - Current plan
 * @param toPlan - Target plan
 * @returns True if toPlan is higher tier
 */
export function isUpgrade(fromPlan: PlanId, toPlan: PlanId): boolean {
  return comparePlans(toPlan, fromPlan) > 0;
}

/**
 * Check if plan is a downgrade
 *
 * @param fromPlan - Current plan
 * @param toPlan - Target plan
 * @returns True if toPlan is lower tier
 */
export function isDowngrade(fromPlan: PlanId, toPlan: PlanId): boolean {
  return comparePlans(toPlan, fromPlan) < 0;
}

/**
 * Calculate annual savings for a plan
 *
 * @param plan - Plan with monthly and annual pricing
 * @returns Dollar amount saved by paying annually
 *
 * @example
 * const savings = calculateAnnualSavings({ priceMonthly: 29, priceAnnual: 290 });
 * // Returns: 58 (saved $58 per year)
 */
export function calculateAnnualSavings(plan: {
  priceMonthly: number;
  priceAnnual: number;
}): number {
  const monthlyTotal = plan.priceMonthly * 12;
  return monthlyTotal - plan.priceAnnual;
}

/**
 * Calculate annual discount percentage
 *
 * @param plan - Plan with monthly and annual pricing
 * @returns Discount percentage (0-100)
 *
 * @example
 * const discount = calculateAnnualDiscountPercent({ priceMonthly: 29, priceAnnual: 290 });
 * // Returns: 17 (17% discount)
 */
export function calculateAnnualDiscountPercent(plan: {
  priceMonthly: number;
  priceAnnual: number;
}): number {
  const monthlyTotal = plan.priceMonthly * 12;
  if (monthlyTotal === 0) return 0;
  return Math.round(((monthlyTotal - plan.priceAnnual) / monthlyTotal) * 100);
}

// ============================================================================
// STRIPE PRICE ID MAPPING
// ============================================================================

/**
 * Map of Stripe Price IDs to Plan IDs
 * Built from environment variables
 */
let PRICE_TO_PLAN_MAP: Record<string, PlanId> | null = null;

/**
 * Initialize the price-to-plan mapping from environment variables
 * Called lazily on first use
 */
function initializePriceMapping(): void {
  if (PRICE_TO_PLAN_MAP !== null) {
    return; // Already initialized
  }

  PRICE_TO_PLAN_MAP = {};

  // Basic plan
  if (process.env.STRIPE_PRICE_ID_BASIC_MONTHLY) {
    PRICE_TO_PLAN_MAP[process.env.STRIPE_PRICE_ID_BASIC_MONTHLY] = "basic";
  }
  if (process.env.STRIPE_PRICE_ID_BASIC_ANNUAL) {
    PRICE_TO_PLAN_MAP[process.env.STRIPE_PRICE_ID_BASIC_ANNUAL] = "basic";
  }

  // Professional plan
  if (process.env.STRIPE_PRICE_ID_PRO_MONTHLY) {
    PRICE_TO_PLAN_MAP[process.env.STRIPE_PRICE_ID_PRO_MONTHLY] = "professional";
  }
  if (process.env.STRIPE_PRICE_ID_PRO_ANNUAL) {
    PRICE_TO_PLAN_MAP[process.env.STRIPE_PRICE_ID_PRO_ANNUAL] = "professional";
  }
}

/**
 * Get plan ID from a Stripe Price ID
 *
 * @param priceId - Stripe Price ID (e.g., "price_1...")
 * @returns Plan ID ("basic" or "professional")
 * @throws Error if price ID is not found
 *
 * @example
 * const planId = getPlanIdFromPriceId("price_1SifavHKhBqmsQOULaZbMJch");
 * // Returns: "basic"
 */
export function getPlanIdFromPriceId(priceId: string): PlanId {
  initializePriceMapping();

  const planId = PRICE_TO_PLAN_MAP![priceId];

  if (!planId) {
    console.error(
      `Unknown Stripe Price ID: ${priceId}. Known prices:`,
      Object.keys(PRICE_TO_PLAN_MAP!)
    );
    throw new Error(`Cannot map Stripe Price ID to Plan: ${priceId}`);
  }

  return planId;
}

/**
 * Get plan ID from a Stripe Price ID (safe version)
 *
 * @param priceId - Stripe Price ID
 * @returns Plan ID or null if not found
 *
 * @example
 * const planId = getPlanIdFromPriceIdSafe("unknown_price_id");
 * // Returns: null
 */
export function getPlanIdFromPriceIdSafe(priceId: string): PlanId | null {
  try {
    return getPlanIdFromPriceId(priceId);
  } catch {
    return null;
  }
}

/**
 * Check if a Stripe Price ID is valid and recognized
 *
 * @param priceId - Stripe Price ID to check
 * @returns true if the price ID maps to a known plan
 */
export function isValidPriceId(priceId: string): boolean {
  initializePriceMapping();
  return priceId in PRICE_TO_PLAN_MAP!;
}

/**
 * Get billing cycle from a Stripe Price ID
 *
 * @param priceId - Stripe Price ID
 * @returns "monthly" or "annual" or null if unknown
 */
export function getBillingCycleFromPriceId(
  priceId: string
): "monthly" | "annual" | null {
  // Check monthly prices
  if (
    priceId === process.env.STRIPE_PRICE_ID_BASIC_MONTHLY ||
    priceId === process.env.STRIPE_PRICE_ID_PRO_MONTHLY
  ) {
    return "monthly";
  }

  // Check annual prices
  if (
    priceId === process.env.STRIPE_PRICE_ID_BASIC_ANNUAL ||
    priceId === process.env.STRIPE_PRICE_ID_PRO_ANNUAL
  ) {
    return "annual";
  }

  return null;
}
