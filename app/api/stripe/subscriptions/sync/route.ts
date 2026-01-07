import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { db } from "@/lib/db";
import { subscriptions, licenseKeys } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getPlan } from "@/lib/stripe/plans";
import { generateLicenseKey } from "@/lib/license/generator";
import type Stripe from "stripe";
import { requireAuth } from "@/lib/api/auth-helpers";
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";
import {
  successResponse,
  handleApiError,
  ValidationError,
} from "@/lib/api/response-helpers";

/**
 * POST /api/stripe/subscriptions/sync
 * Manually syncs subscription from Stripe (for local development when webhooks don't work)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const { sessionId } = await request.json();
    if (!sessionId) {
      throw new ValidationError("Session ID required");
    }

    const customer = await getCustomerOrThrow(session.user.id);

    // Retrieve checkout session from Stripe
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (!checkoutSession.subscription) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      );
    }

    const subscriptionId =
      typeof checkoutSession.subscription === "string"
        ? checkoutSession.subscription
        : checkoutSession.subscription?.id;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "No subscription ID found" },
        { status: 404 }
      );
    }

    const stripeSubscription = (await stripe.subscriptions.retrieve(
      subscriptionId
    )) as unknown as Stripe.Subscription & {
      current_period_start: number;
      current_period_end: number;
      trial_start: number | null;
      trial_end: number | null;
    };

    // Access subscription properties - they exist natively on Stripe.Subscription
    const currentPeriodStart = stripeSubscription.current_period_start;
    const currentPeriodEnd = stripeSubscription.current_period_end;
    const trialStart = stripeSubscription.trial_start;
    const trialEnd = stripeSubscription.trial_end;

    // Handle trialing subscriptions - use trial dates as period dates
    const isTrialing = stripeSubscription.status === "trialing";
    const periodStart = isTrialing
      ? trialStart ?? currentPeriodStart
      : currentPeriodStart;
    const periodEnd = isTrialing
      ? trialEnd ?? currentPeriodEnd
      : currentPeriodEnd;

    // Type guard to ensure we have the required properties (after fallback logic)
    if (!periodStart || !periodEnd) {
      console.error("Missing period dates:", {
        currentPeriodStart,
        currentPeriodEnd,
        trialStart,
        trialEnd,
        periodStart,
        periodEnd,
        subscriptionId: stripeSubscription.id,
        status: stripeSubscription.status,
      });
      return NextResponse.json(
        { error: "Subscription missing required period dates" },
        { status: 400 }
      );
    }

    // Check if subscription already exists
    const [existingSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscription.id))
      .limit(1);

    if (existingSub) {
      return NextResponse.json({
        message: "Subscription already synced",
        subscription: existingSub,
      });
    }

    // Get plan details from metadata
    const planId = (checkoutSession.metadata?.planId || "basic") as any;
    const billingCycle = (checkoutSession.metadata?.billingCycle ||
      "monthly") as any;

    const plan = await getPlan(planId);
    const price =
      billingCycle === "monthly" ? plan.priceMonthly : plan.priceAnnual;

    // Log subscription data for debugging
    console.log("Stripe subscription data:", {
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      trial_start: trialStart ?? null,
      trial_end: trialEnd ?? null,
      periodStart,
      periodEnd,
      status: stripeSubscription.status,
    });

    // Validate timestamps before creating dates
    const validateTimestamp = (
      timestamp: number | null | undefined,
      fieldName: string
    ) => {
      if (timestamp === null || timestamp === undefined) {
        throw new Error(`${fieldName} is null or undefined`);
      }
      if (isNaN(timestamp) || timestamp <= 0) {
        throw new Error(`${fieldName} is invalid: ${timestamp}`);
      }
      return timestamp;
    };

    // Create subscription
    const [newSubscription] = await db
      .insert(subscriptions)
      .values({
        customerId: customer.id,
        planId,
        planType: planId,
        billingCycle,
        price: price.toString(),
        status: isTrialing ? "trialing" : "active",
        currentPeriodStart: new Date(
          validateTimestamp(periodStart, "current_period_start") * 1000
        ),
        currentPeriodEnd: new Date(
          validateTimestamp(periodEnd, "current_period_end") * 1000
        ),
        nextBillingDate: new Date(
          validateTimestamp(periodEnd, "current_period_end (nextBillingDate)") *
            1000
        ),
        trialStart: trialStart ? new Date(trialStart * 1000) : null,
        trialEnd: trialEnd ? new Date(trialEnd * 1000) : null,
        autoRenew: !stripeSubscription.cancel_at_period_end,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: stripeSubscription.customer as string,
        metadata: {
          stripePriceId: stripeSubscription.items.data[0].price.id,
        },
      })
      .returning();

    // Plan code mapping for license key prefix
    const PLAN_CODES: Record<string, string> = {
      basic: "BAS",
      professional: "PRO",
      enterprise: "ENT",
    };

    // Check for existing license key
    const [existingLicense] = await db
      .select()
      .from(licenseKeys)
      .where(eq(licenseKeys.customerId, customer.id))
      .orderBy(desc(licenseKeys.createdAt))
      .limit(1);

    let licenseKeyValue: string;

    // Determine if we need a new license based on plan tier change
    const currentPlanCode = PLAN_CODES[plan.id] || "BAS";
    const existingPlanCode = existingLicense?.licenseKey?.split("-")[1]; // e.g., "AUR-BAS-V2-xxx" -> "BAS"
    const planTierChanged =
      existingLicense && existingPlanCode !== currentPlanCode;

    if (existingLicense && !existingLicense.revokedAt && !planTierChanged) {
      // Reuse existing license - same plan tier, just billing cycle or reactivation
      licenseKeyValue = existingLicense.licenseKey;

      await db
        .update(licenseKeys)
        .set({
          subscriptionId: newSubscription.id,
          maxTerminals: plan.features.maxTerminals,
          isActive: true,
        })
        .where(eq(licenseKeys.id, existingLicense.id));

      console.log(
        `[Sync] Reusing existing license: ${licenseKeyValue.substring(
          0,
          15
        )}...`
      );
    } else {
      // Generate NEW license if:
      // - No previous license exists
      // - Previous license was revoked
      // - Plan TIER changed (BAS → PRO, PRO → ENT, etc.)

      // Deactivate old license if plan tier changed
      if (existingLicense && planTierChanged) {
        await db
          .update(licenseKeys)
          .set({
            isActive: false,
            revokedAt: new Date(),
            revocationReason: `Upgraded to ${plan.id} plan`,
          })
          .where(eq(licenseKeys.id, existingLicense.id));

        console.log(
          `[Sync] Deactivated old license due to plan tier change: ${existingPlanCode} → ${currentPlanCode}`
        );
      }

      licenseKeyValue = generateLicenseKey(plan.id, customer.id);

      await db.insert(licenseKeys).values({
        customerId: customer.id,
        subscriptionId: newSubscription.id,
        licenseKey: licenseKeyValue,
        maxTerminals: plan.features.maxTerminals,
        activationCount: 0,
        version: "2.0",
        issuedAt: new Date(),
        isActive: true,
      });

      console.log(
        `[Sync] Generated new license: ${licenseKeyValue.substring(
          0,
          15
        )}... (plan: ${plan.id})`
      );
    }

    return successResponse({
      message: "Subscription synced successfully",
      subscription: newSubscription,
      licenseKey: licenseKeyValue,
    });
  } catch (error) {
    return handleApiError(error, "Failed to sync subscription");
  }
}

