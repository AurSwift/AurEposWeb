import type { PlanId } from "./plans";

/**
 * Plan display name mapping
 * Single source of truth for plan names across the application
 */
const PLAN_DISPLAY_NAMES: Record<PlanId, string> = {
  basic: "Basic Plan",
  professional: "Professional Plan",
  enterprise: "Enterprise Plan",
} as const;

/**
 * Short plan name mapping (for compact displays)
 */
const PLAN_SHORT_NAMES: Record<PlanId, string> = {
  basic: "Basic",
  professional: "Pro",
  enterprise: "Enterprise",
} as const;

/**
 * Plan code mapping (for license keys)
 */
export const PLAN_CODES: Record<PlanId, string> = {
  basic: "BAS",
  professional: "PRO",
  enterprise: "ENT",
} as const;

/**
 * Reverse mapping: code to plan ID
 */
export const CODE_TO_PLAN: Record<string, PlanId> = {
  BAS: "basic",
  PRO: "professional",
  ENT: "enterprise",
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
    ["basic", "professional", "enterprise"].includes(id)
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
    enterprise: 3,
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
