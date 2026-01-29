import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe/client";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import {
  subscriptions,
  licenseKeys,
  subscriptionChanges,
  activations,
} from "@/lib/db/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import {
  getStripePriceId,
  getPlan,
  type PlanId,
  type BillingCycle,
} from "@/lib/stripe/plans";
import { createProrationPayment } from "@/lib/db/payment-helpers";
import { requireAuth } from "@/lib/api/auth-helpers";
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";
import {
  successResponse,
  handleApiError,
  ValidationError,
} from "@/lib/api/response-helpers";
import {
  isValidPlanId,
  isUpgrade as checkIsUpgrade,
} from "@/lib/stripe/plan-utils";
import { generateLicenseKey } from "@/lib/license/generator";
import { getPlanFeatures } from "@/lib/license/validator";
import {
  publishLicenseRevoked,
  publishPlanChanged,
  getLicenseKeysForSubscription,
} from "@/lib/subscription-events";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const { subscriptionId, newPlanId, newBillingCycle } =
      (await request.json()) as {
        subscriptionId: string;
        newPlanId: PlanId;
        newBillingCycle?: BillingCycle;
      };

    if (!subscriptionId || !newPlanId) {
      throw new ValidationError("Subscription ID and new plan ID are required");
    }

    // Validate plan ID
    if (!isValidPlanId(newPlanId)) {
      throw new ValidationError("Invalid plan ID");
    }

    const customer = await getCustomerOrThrow(session.user.id);

    // Get current subscription
    const [currentSub] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.id, subscriptionId),
          eq(subscriptions.customerId, customer.id)
        )
      )
      .limit(1);

    if (!currentSub || !currentSub.stripeSubscriptionId) {
      throw new ValidationError("Subscription not found");
    }

    // Check if subscription is in trial period
    const isInTrial = currentSub.trialEnd && new Date(currentSub.trialEnd) > new Date();
    
    // Limit plan changes during trial (max 4 changes)
    if (isInTrial && (currentSub.trialPlanChanges || 0) >= 4) {
      throw new ValidationError(
        "You have reached the maximum number of plan changes (4) during your trial period. Please wait until your trial ends or contact support."
      );
    }

    // Determine billing cycle (use existing if not provided)
    const billingCycle =
      newBillingCycle || (currentSub.billingCycle as BillingCycle);

    // Get new plan details
    const newPlan = await getPlan(newPlanId);
    const newPrice =
      billingCycle === "monthly" ? newPlan.priceMonthly : newPlan.priceAnnual;
    const newPriceId = await getStripePriceId(newPlanId, billingCycle);

    // Get current Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(
      currentSub.stripeSubscriptionId
    );

    // Update subscription in Stripe
    const updatedSubscription = await stripe.subscriptions.update(
      currentSub.stripeSubscriptionId,
      {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_behavior: "create_prorations", // Prorate the change
        metadata: {
          ...stripeSubscription.metadata,
          planId: newPlanId,
          billingCycle,
        },
      }
    );

    // Retrieve actual proration details from upcoming invoice
    let prorationAmount = 0;
    let currency = "USD";
    let stripePaymentId: string | null = null;
    let invoiceUrl: string | null = null;

    try {
      const upcomingInvoice = await (stripe.invoices as any).retrieveUpcoming({
        customer: currentSub.stripeCustomerId!,
        subscription: currentSub.stripeSubscriptionId,
      }) as Stripe.Invoice;

      // Calculate proration from invoice lines
      const prorationLines = upcomingInvoice.lines.data.filter(
        (line) => (line as any).proration
      );

      const prorationAmountCents = prorationLines.reduce(
        (sum, line) => sum + line.amount,
        0
      );

      prorationAmount = prorationAmountCents / 100; // Convert cents to dollars
      currency = upcomingInvoice.currency.toUpperCase();

      // Check if there's an immediate invoice for the proration
      if (upcomingInvoice.id && upcomingInvoice.id !== "upcoming") {
        // Handle payment_intent which can be string, PaymentIntent object, or null
        const paymentIntent = (upcomingInvoice as any).payment_intent;
        stripePaymentId =
          typeof paymentIntent === "string"
            ? paymentIntent
            : (paymentIntent as { id?: string } | null)?.id || null;
        invoiceUrl = upcomingInvoice.hosted_invoice_url || null;
      }
    } catch (prorationError) {
      // If we can't retrieve the upcoming invoice, log but continue
      // The subscription update was successful, so we don't want to fail
      console.error("Could not retrieve proration details:", prorationError);
    }

    // Determine if this is an upgrade or downgrade
    const isUpgradeChange =
      currentSub.planId && isValidPlanId(currentSub.planId)
        ? checkIsUpgrade(currentSub.planId as PlanId, newPlanId)
        : newPrice > parseFloat(currentSub.price || "0");
    const changeType = isUpgradeChange ? "plan_upgrade" : "plan_downgrade";

    // Get all old license keys before transaction (for SSE events)
    const oldLicenseKeysList = await getLicenseKeysForSubscription(
      subscriptionId
    );

    // Update database in a transaction
    let newLicenseKey: string | null = null;
    await db.transaction(async (tx) => {
      // Update subscription and increment trial plan changes if in trial
      const updateData: any = {
        planId: newPlanId,
        billingCycle,
        price: newPrice.toString(),
        updatedAt: new Date(),
        metadata: {
          ...(currentSub.metadata || {}),
          stripePriceId: newPriceId,
        },
      };

      // Increment trial plan changes counter if in trial
      if (isInTrial) {
        updateData.trialPlanChanges = (currentSub.trialPlanChanges || 0) + 1;
      }

      await tx
        .update(subscriptions)
        .set(updateData)
        .where(eq(subscriptions.id, subscriptionId));

      // Record change
      await tx.insert(subscriptionChanges).values({
        subscriptionId,
        customerId: customer.id,
        changeType,
        previousPlanId: currentSub.planId,
        newPlanId,
        previousBillingCycle: currentSub.billingCycle,
        newBillingCycle: billingCycle,
        previousPrice: currentSub.price,
        newPrice: newPrice.toString(),
        prorationAmount: prorationAmount.toString(),
        effectiveDate: new Date(),
        reason: `Plan changed from ${currentSub.planId} to ${newPlanId}`,
        metadata: {
          changedBy: session.user.id,
          stripeSubscriptionId: currentSub.stripeSubscriptionId,
          oldLicenseKeys: oldLicenseKeysList,
        },
      });

      // ⚠️ CRITICAL: Revoke all old license keys and generate new one
      // During trial: Auto-migrate activations for seamless UX
      // After trial: Force reactivation (old behavior)
      
      // Get existing activations before revoking licenses
      // First get license keys for this subscription, then get their activations
      let existingActivations: typeof activations.$inferSelect[] = [];
      if (isInTrial) {
        // Get all license keys for this subscription
        const subscriptionLicenseKeys = await tx
          .select({ licenseKey: licenseKeys.licenseKey })
          .from(licenseKeys)
          .where(eq(licenseKeys.subscriptionId, subscriptionId));
        
        if (subscriptionLicenseKeys.length > 0) {
          // Get activations for all these license keys
          const licenseKeyValues = subscriptionLicenseKeys.map(k => k.licenseKey);
          existingActivations = await tx
            .select()
            .from(activations)
            .where(
              licenseKeyValues.length === 1
                ? eq(activations.licenseKey, licenseKeyValues[0])
                : inArray(activations.licenseKey, licenseKeyValues)
            );
        }
      }

      await tx
        .update(licenseKeys)
        .set({
          isActive: false,
          revokedAt: new Date(),
          revocationReason: isInTrial
            ? `Plan changed from ${currentSub.planId} to ${newPlanId} - activations auto-migrated`
            : `Plan changed from ${currentSub.planId} to ${newPlanId} - new license key required`,
        })
        .where(eq(licenseKeys.subscriptionId, subscriptionId));

      // Generate new license key for the new plan
      newLicenseKey = generateLicenseKey(newPlanId, customer.id);

      // Create new license key
      const [insertedLicense] = await tx.insert(licenseKeys).values({
        customerId: customer.id,
        subscriptionId,
        licenseKey: newLicenseKey,
        maxTerminals: newPlan.features.maxTerminals,
        activationCount: existingActivations.length,
        isActive: true,
        issuedAt: new Date(),
        expiresAt: null, // Subscription-based, no expiry
      }).returning();

      // Auto-migrate activations during trial period
      if (isInTrial && existingActivations.length > 0) {
        console.log(`[Trial Migration] Auto-migrating ${existingActivations.length} activation(s) to new license`);
        
        // Update all activations to point to the new license key
        for (const activation of existingActivations) {
          await tx
            .update(activations)
            .set({
              licenseKey: newLicenseKey, // Update to new license key string
              updatedAt: new Date(),
            })
            .where(eq(activations.id, activation.id));
        }
      }

      // Create proration payment record (if applicable and positive)
      // Uses transaction for atomicity
      await createProrationPayment(
        customer.id,
        subscriptionId,
        prorationAmount,
        currency,
        new Date((updatedSubscription as any).current_period_start * 1000),
        new Date((updatedSubscription as any).current_period_end * 1000),
        stripePaymentId,
        invoiceUrl,
        tx
      );
    });

    // 🔔 SSE: Notify desktop apps about plan change and license revocation
    // Send events to all old license keys
    console.log(
      `[Plan Change] Sending SSE events to ${oldLicenseKeysList.length} license key(s)`,
      {
        oldKeys: oldLicenseKeysList,
        newLicenseKey,
        planChange: `${currentSub.planId} → ${newPlanId}`,
      }
    );

    for (const oldKey of oldLicenseKeysList) {
      console.log(`[Plan Change] Publishing license_revoked to ${oldKey}`);
      // First, notify about license revocation
      publishLicenseRevoked(oldKey, {
        reason: `Plan changed from ${currentSub.planId} to ${newPlanId}. Please reactivate with your new license key: ${newLicenseKey}`,
      });

      console.log(`[Plan Change] Publishing plan_changed to ${oldKey}`);
      // Then, send plan change event for UI updates
      publishPlanChanged(oldKey, {
        previousPlanId: currentSub.planId || "basic",
        newPlanId,
        newFeatures: getPlanFeatures(newPlanId),
        effectiveAt: new Date(),
      });
    }

    console.log("[Plan Change] SSE events published successfully");

    return successResponse({
      success: true,
      message: `Successfully ${
        isUpgradeChange ? "upgraded" : "downgraded"
      } to ${
        newPlan.name
      } plan. A new license key has been generated. Please reactivate your desktop app.`,
      subscription: {
        planId: newPlanId,
        billingCycle,
        price: newPrice,
        prorationAmount,
      },
      newLicenseKey,
      requiresReactivation: true,
    });
  } catch (error) {
    return handleApiError(error, "Failed to change plan");
  }
}
