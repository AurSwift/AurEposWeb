import { stripe } from "./client";
import type Stripe from "stripe";

export type PlanId = "basic" | "professional";
export type BillingCycle = "monthly" | "annual";

export interface PlanFeatures {
  maxTerminals: number;
  features: string[];
  limits: {
    users: number;
    storage: string;
    apiAccess: boolean;
    support: string;
  };
}

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  priceMonthly: number;
  priceAnnual: number;
  annualDiscountPercent: number;
  stripePriceIdMonthly: string;
  stripePriceIdAnnual: string;
  stripeProductId: string;
  features: PlanFeatures;
  popular?: boolean;
}

// Plan features are business logic, kept separate from pricing
// These map to plan IDs and define what each plan includes
const PLAN_FEATURES: Record<PlanId, PlanFeatures> = {
  basic: {
    maxTerminals: 3,
    features: [
      "Up to 3 terminals",
      "Basic inventory management",
      "Sales reporting",
      "Email support (48hr response)",
    ],
    limits: {
      users: 1,
      storage: "5GB",
      apiAccess: false,
      support: "email",
    },
  },
  professional: {
    maxTerminals: 5,
    features: [
      "Up to 5 terminals",
      "Basic inventory management",
      "Sales reporting",
      "Advanced reporting & analytics",
      "Priority email support (24hr response)",
    ],
    limits: {
      users: 5,
      storage: "50GB",
      apiAccess: false,
      support: "priority_email",
    },
  },
};

// Plans that should be marked as popular
const POPULAR_PLANS: PlanId[] = ["professional"];

// Plan names and descriptions (fallback if not in Stripe)
const PLAN_NAMES: Record<PlanId, string> = {
  basic: "Basic",
  professional: "Professional",
};

const PLAN_DESCRIPTIONS: Record<PlanId, string> = {
  basic: "Perfect for small businesses",
  professional: "For growing businesses",
};

// In-memory cache for plans
let cachedPlans: Record<PlanId, Plan> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 1000 * 60 * 15; // 15 minutes

/**
 * Fallback: Fetch plans using Price IDs from environment variables
 * This is used when products don't have metadata.planId set
 */
async function fetchPlansFromEnvPriceIds(): Promise<Record<PlanId, Plan>> {
  const priceIdMap: Record<PlanId, { monthly?: string; annual?: string }> = {
    basic: {
      monthly: process.env.STRIPE_PRICE_ID_BASIC_MONTHLY,
      annual: process.env.STRIPE_PRICE_ID_BASIC_ANNUAL,
    },
    professional: {
      monthly: process.env.STRIPE_PRICE_ID_PRO_MONTHLY,
      annual: process.env.STRIPE_PRICE_ID_PRO_ANNUAL,
    },
  };

  const plans: Partial<Record<PlanId, Plan>> = {};

  for (const [planId, priceIds] of Object.entries(priceIdMap)) {
    const id = planId as PlanId;

    if (!priceIds.monthly || !priceIds.annual) {
      console.warn(`Missing Price IDs for ${planId} in environment variables`);
      continue;
    }

    try {
      // Fetch both prices
      const [monthlyPrice, annualPrice] = await Promise.all([
        stripe.prices.retrieve(priceIds.monthly),
        stripe.prices.retrieve(priceIds.annual),
      ]);

      // Get product from monthly price
      const productId =
        typeof monthlyPrice.product === "string"
          ? monthlyPrice.product
          : monthlyPrice.product.id;

      const product = await stripe.products.retrieve(productId);

      // Convert prices from cents to dollars
      const priceMonthly = (monthlyPrice.unit_amount || 0) / 100;
      const priceAnnual = (annualPrice.unit_amount || 0) / 100;

      // Calculate annual discount percent
      const monthlyTotal = priceMonthly * 12;
      const annualDiscountPercent =
        monthlyTotal > 0
          ? Math.round(((monthlyTotal - priceAnnual) / monthlyTotal) * 100)
          : 0;

      // Build plan object
      plans[id] = {
        id,
        name: product.deleted ? PLAN_NAMES[id] : product.name || PLAN_NAMES[id],
        description:
          product.deleted || !product.description
            ? PLAN_DESCRIPTIONS[id]
            : product.description,
        priceMonthly,
        priceAnnual,
        annualDiscountPercent,
        stripePriceIdMonthly: monthlyPrice.id,
        stripePriceIdAnnual: annualPrice.id,
        stripeProductId: productId,
        features: PLAN_FEATURES[id],
        popular: POPULAR_PLANS.includes(id),
      };
    } catch (error) {
      console.error(`Error fetching plan ${planId} from Price IDs:`, error);
    }
  }

  // Validate we have all required plans
  const requiredPlans: PlanId[] = ["basic", "professional"];
  const missingPlans = requiredPlans.filter((id) => !plans[id]);

  if (missingPlans.length > 0) {
    throw new Error(
      `Missing required plans: ${missingPlans.join(
        ", "
      )}. Check your environment variables.`
    );
  }

  return plans as Record<PlanId, Plan>;
}

/**
 * Fetches all plans from Stripe and maps them to our Plan interface
 * Uses caching to avoid hitting Stripe API on every request
 */
async function fetchPlansFromStripe(): Promise<Record<PlanId, Plan>> {
  const now = Date.now();

  // Return cached plans if still valid
  if (cachedPlans && now - cacheTimestamp < CACHE_TTL) {
    return cachedPlans;
  }

  try {
    // Fetch all active products from Stripe
    const products = await stripe.products.list({
      active: true,
      limit: 100,
    });

    const plans: Partial<Record<PlanId, Plan>> = {};

    // Process each product
    for (const product of products.data) {
      // Skip deleted products
      if (product.deleted) continue;

      // Get plan ID from metadata (Stripe product should have metadata.planId)
      const planId = product.metadata?.planId as PlanId | undefined;
      if (!planId || !isValidPlanId(planId)) {
        console.warn(
          `Product ${product.id} missing or invalid planId metadata`
        );
        continue;
      }

      // Fetch all prices for this product
      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
      });

      // Find monthly and annual prices
      let monthlyPrice: Stripe.Price | null = null;
      let annualPrice: Stripe.Price | null = null;

      for (const price of prices.data) {
        if (price.type !== "recurring") continue;

        const interval = price.recurring?.interval;
        if (interval === "month") {
          monthlyPrice = price;
        } else if (interval === "year") {
          annualPrice = price;
        }
      }

      // Skip if we don't have both prices
      if (!monthlyPrice || !annualPrice) {
        console.warn(
          `Product ${product.id} (${planId}) missing monthly or annual price`
        );
        continue;
      }

      // Convert prices from cents to dollars
      const priceMonthly = (monthlyPrice.unit_amount || 0) / 100;
      const priceAnnual = (annualPrice.unit_amount || 0) / 100;

      // Calculate annual discount percent
      const monthlyTotal = priceMonthly * 12;
      const annualDiscountPercent =
        monthlyTotal > 0
          ? Math.round(((monthlyTotal - priceAnnual) / monthlyTotal) * 100)
          : 0;

      // Get features for this plan
      const features = PLAN_FEATURES[planId];

      // Build plan object
      plans[planId] = {
        id: planId,
        name: product.name,
        description: product.description || "",
        priceMonthly,
        priceAnnual,
        annualDiscountPercent,
        stripePriceIdMonthly: monthlyPrice.id,
        stripePriceIdAnnual: annualPrice.id,
        stripeProductId: product.id,
        features,
        popular: POPULAR_PLANS.includes(planId),
      };
    }

    // Validate we have all required plans
    const requiredPlans: PlanId[] = ["basic", "professional"];
    const missingPlans = requiredPlans.filter((id) => !plans[id]);

    if (missingPlans.length > 0) {
      console.warn(
        `Missing required plans in Stripe (metadata method): ${missingPlans.join(
          ", "
        )}`
      );
      console.log("Attempting fallback to environment variable Price IDs...");
      // Fall through to fallback method
      throw new Error("Missing plans from metadata method");
    }

    // Update cache
    cachedPlans = plans as Record<PlanId, Plan>;
    cacheTimestamp = now;

    return cachedPlans;
  } catch (error) {
    console.error("Error fetching plans from Stripe (metadata method):", error);
    console.log("Falling back to environment variable Price IDs...");

    // Fallback to environment variable Price IDs
    try {
      const plans = await fetchPlansFromEnvPriceIds();
      cachedPlans = plans;
      cacheTimestamp = now;
      return plans;
    } catch (fallbackError) {
      console.error("Error fetching plans from Price IDs:", fallbackError);

      // If we have cached plans, return them even if expired
      if (cachedPlans) {
        console.warn("Using expired cache due to Stripe error");
        return cachedPlans;
      }

      // Last resort: throw error
      throw new Error(
        "Failed to fetch plans from Stripe. Please check your Stripe products have metadata.planId set, or ensure Price IDs are set in environment variables."
      );
    }
  }
}

/**
 * Type guard to validate plan IDs
 */
function isValidPlanId(id: string): id is PlanId {
  return ["basic", "professional"].includes(id);
}

/**
 * Get all plans (fetched from Stripe)
 */
export async function getPlans(): Promise<Record<PlanId, Plan>> {
  return fetchPlansFromStripe();
}

/**
 * Get a specific plan by ID
 */
export async function getPlan(planId: PlanId): Promise<Plan> {
  const plans = await getPlans();
  const plan = plans[planId];

  if (!plan) {
    throw new Error(`Plan not found: ${planId}`);
  }

  return plan;
}

/**
 * Get price for a specific plan and billing cycle
 */
export async function getPrice(
  planId: PlanId,
  cycle: BillingCycle
): Promise<number> {
  const plan = await getPlan(planId);
  return cycle === "monthly" ? plan.priceMonthly : plan.priceAnnual;
}

/**
 * Get Stripe Price ID for a plan and billing cycle
 */
export async function getStripePriceId(
  planId: PlanId,
  cycle: BillingCycle
): Promise<string> {
  const plan = await getPlan(planId);
  const priceId =
    cycle === "monthly" ? plan.stripePriceIdMonthly : plan.stripePriceIdAnnual;

  if (!priceId) {
    throw new Error(`Stripe Price ID not found for plan ${planId} (${cycle})`);
  }

  return priceId;
}

/**
 * Calculate annual savings for a plan
 */
export async function calculateAnnualSavings(planId: PlanId): Promise<number> {
  const plan = await getPlan(planId);
  const monthlyTotal = plan.priceMonthly * 12;
  return monthlyTotal - plan.priceAnnual;
}

/**
 * Clear the plans cache (useful for testing or manual refresh)
 */
export function clearPlansCache(): void {
  cachedPlans = null;
  cacheTimestamp = 0;
}

// Removed deprecated PLANS export - use getPlans() instead
