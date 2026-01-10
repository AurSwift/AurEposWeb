import { db } from "@/lib/db";
import {
  customers,
  subscriptions,
  licenseKeys,
  subscriptionChanges,
  paymentMethods,
  invoices,
} from "@/lib/db/schema";
import { eq, and, or, sql, desc } from "drizzle-orm";
import { generateLicenseKey } from "@/lib/license/generator";
import { getPlan, type PlanId } from "@/lib/stripe/plans";
import {
  createPaymentFromCheckoutSession,
  createPaymentFromInvoice,
} from "@/lib/db/payment-helpers";
import { stripe } from "@/lib/stripe/client";
import Stripe from "stripe";
import {
  getLicenseKeysForSubscription,
  publishSubscriptionCancelled,
  publishSubscriptionReactivated,
  publishSubscriptionUpdated,
  publishSubscriptionPastDue,
  publishPaymentSucceeded,
  publishLicenseReactivated,
  publishLicenseRevoked,
} from "@/lib/subscription-events";
import { getPlanFeatures } from "@/lib/license/validator";
import { withTransaction } from "@/lib/stripe/webhook-helpers";

// ============================================================================
// TYPE DEFINITIONS FOR STRIPE WEBHOOK DATA
// ============================================================================

export interface CheckoutSessionData {
  id: string;
  metadata?: {
    customerId?: string;
    planId?: string;
    billingCycle?: "monthly" | "annual";
  };
  subscription?: string;
  payment_intent?: string;
  amount_total?: number | null;
  currency?: string | null;
}

export interface StripeSubscriptionData {
  id: string;
  status: Stripe.Subscription.Status;
  customer: string | Stripe.Customer | Stripe.DeletedCustomer;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  trial_start: number | null;
  trial_end: number | null;
  latest_invoice?: string | Stripe.Invoice | null;
  items: {
    data: Array<{
      price: {
        id: string;
      };
    }>;
  };
}

export interface StripeInvoiceData {
  id: string;
  customer: string | Stripe.Customer;
  subscription?: string | Stripe.Subscription | null;
  amount_paid: number;
  amount_due: number;
  amount_remaining: number;
  subtotal: number;
  tax: number | null;
  total: number;
  currency: string;
  status?: Stripe.Invoice.Status | null;
  payment_intent?: string | Stripe.PaymentIntent | null;
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
  number?: string | null;
  description?: string | null;
  due_date?: number | null;
  period_start: number;
  period_end: number;
  metadata?: Stripe.Metadata;
  status_transitions?: {
    paid_at?: number | null;
  };
}

export interface StripePaymentMethodData {
  id: string;
  customer: string | Stripe.Customer;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
    funding: string;
    country: string;
  };
}

export interface StripeCustomerData {
  id: string;
  email: string | null;
  name: string | null;
  metadata: Record<string, string>;
  deleted?: boolean;
}

// ============================================================================
// HANDLER FUNCTIONS
// ============================================================================

export async function handleCheckoutCompleted(session: CheckoutSessionData) {
  const customerId = session.metadata?.customerId;
  const planId = session.metadata?.planId as PlanId | undefined;
  const billingCycle = session.metadata?.billingCycle;

  if (!customerId || !planId || !billingCycle) {
    console.warn("Missing metadata in checkout session, skipping fulfillment");
    return;
  }

  // Get subscription from Stripe
  const subscriptionId = session.subscription;
  if (!subscriptionId) {
    throw new Error("No subscription ID in checkout session");
  }

  const stripeSubscription = (await stripe.subscriptions.retrieve(
    subscriptionId
  )) as unknown as StripeSubscriptionData;

  // Get customer
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);

  if (!customer) {
    throw new Error("Customer not found");
  }

  // 🔄 RESTORE DELETED CUSTOMER: If customer was previously deleted,
  // restore them when they successfully complete a new checkout
  if (customer.status === "deleted") {
    console.log(
      `[Webhook] Restoring deleted customer ${customer.id} after successful checkout`
    );

    await db
      .update(customers)
      .set({
        status: "active",
        stripeCustomerId: stripeSubscription.customer as string,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customer.id));

    console.log(
      `[Webhook] ✅ Customer ${customer.id} restored to active status`
    );
  }

  const plan = await getPlan(planId);
  const price =
    billingCycle === "monthly" ? plan.priceMonthly : plan.priceAnnual;

  // Calculate billing period dates - handle undefined/null timestamps
  const currentPeriodStart = stripeSubscription.current_period_start
    ? new Date(stripeSubscription.current_period_start * 1000)
    : new Date();

  const currentPeriodEnd = stripeSubscription.current_period_end
    ? new Date(stripeSubscription.current_period_end * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default to 30 days from now

  const trialEnd =
    stripeSubscription.trial_end && stripeSubscription.trial_end > 0
      ? new Date(stripeSubscription.trial_end * 1000)
      : null;

  const trialStart =
    stripeSubscription.trial_start && stripeSubscription.trial_start > 0
      ? new Date(stripeSubscription.trial_start * 1000)
      : null;

  // Plan code mapping for license key prefix
  const PLAN_CODES: Record<string, string> = {
    basic: "BAS",
    professional: "PRO",
    enterprise: "ENT",
  };

  // Use transaction for subscription creation + license management + audit logging
  const { subscription, licenseKeyValue } = await withTransaction(
    async (tx) => {
      // Check for existing active subscriptions (prevent duplicates)
      const existingActiveSubscriptions = await tx
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.customerId, customer.id),
            or(
              eq(subscriptions.status, "active"),
              eq(subscriptions.status, "trialing")
            )
          )
        );

      // If there are existing active subscriptions, cancel them
      if (existingActiveSubscriptions.length > 0) {
        console.log(
          `[Webhook] Found ${existingActiveSubscriptions.length} existing active subscription(s) for customer ${customer.id}`
        );

        for (const existingSub of existingActiveSubscriptions) {
          // Cancel in Stripe
          if (existingSub.stripeSubscriptionId) {
            try {
              await stripe.subscriptions.cancel(
                existingSub.stripeSubscriptionId
              );
              console.log(
                `[Webhook] Cancelled old Stripe subscription: ${existingSub.stripeSubscriptionId}`
              );
            } catch (error) {
              console.warn(
                `Failed to cancel old subscription ${existingSub.stripeSubscriptionId}:`,
                error
              );
            }
          }

          // Cancel in DB
          await tx
            .update(subscriptions)
            .set({
              status: "cancelled",
              canceledAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.id, existingSub.id));
        }
      }

      // Create subscription record
      const [subscriptionRecord] = await tx
        .insert(subscriptions)
        .values({
          customerId: customer.id,
          planId,
          planType: planId, // Keep for backward compatibility
          billingCycle,
          price: price.toString(),
          status:
            stripeSubscription.status === "trialing" ? "trialing" : "active",
          currentPeriodStart,
          currentPeriodEnd,
          nextBillingDate: currentPeriodEnd,
          trialStart,
          trialEnd,
          autoRenew: !stripeSubscription.cancel_at_period_end,
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: stripeSubscription.customer as string,
          metadata: {
            stripePriceId: stripeSubscription.items.data[0].price.id,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Check for existing license key
      const [existingLicense] = await tx
        .select()
        .from(licenseKeys)
        .where(eq(licenseKeys.customerId, customer.id))
        .orderBy(desc(licenseKeys.createdAt))
        .limit(1);

      let licenseKey: string;

      // Determine if we need a new license based on plan tier change
      const currentPlanCode = PLAN_CODES[planId] || "BAS";
      const existingPlanCode = existingLicense?.licenseKey?.split("-")[1]; // e.g., "AUR-BAS-V2-xxx" -> "BAS"
      const planTierChanged =
        existingLicense && existingPlanCode !== currentPlanCode;

      if (existingLicense && !existingLicense.revokedAt && !planTierChanged) {
        // Reuse existing license - same plan tier, just billing cycle or reactivation
        licenseKey = existingLicense.licenseKey;

        await tx
          .update(licenseKeys)
          .set({
            subscriptionId: subscriptionRecord.id,
            maxTerminals: plan.features.maxTerminals,
            isActive: true,
          })
          .where(eq(licenseKeys.id, existingLicense.id));

        console.log(
          `[Webhook] Reusing existing license: ${licenseKey.substring(
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
          await tx
            .update(licenseKeys)
            .set({
              isActive: false,
              revokedAt: new Date(),
              revocationReason: `Upgraded to ${planId} plan`,
            })
            .where(eq(licenseKeys.id, existingLicense.id));

          console.log(
            `[Webhook] Deactivated old license due to plan tier change: ${existingPlanCode} → ${currentPlanCode}`
          );
        }

        licenseKey = generateLicenseKey(planId, customer.id);

        await tx.insert(licenseKeys).values({
          customerId: customer.id,
          subscriptionId: subscriptionRecord.id,
          licenseKey: licenseKey,
          maxTerminals: plan.features.maxTerminals,
          isActive: true,
          version: "2.0",
          issuedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        console.log(
          `[Webhook] Generated new license: ${licenseKey.substring(
            0,
            15
          )}... (plan: ${planId})`
        );
      }

      // Log to subscription changes
      await tx.insert(subscriptionChanges).values({
        subscriptionId: subscriptionRecord.id,
        customerId: customer.id,
        changeType: "subscription_created",
        newPlanId: planId,
        newBillingCycle: billingCycle,
        newPrice: price.toString(),
        effectiveDate: new Date(),
        reason: "New subscription via checkout",
        createdAt: new Date(),
      });

      return {
        subscription: subscriptionRecord,
        licenseKeyValue: licenseKey,
        planTierChanged,
        existingPlanCode,
        currentPlanCode,
      };
    }
  );

  // =========================================================================
  // PUBLISH PLAN CHANGE EVENT (SSE)
  // If plan tier changed during checkout, notify desktop apps
  // =========================================================================
  if (subscription.planTierChanged && subscription.existingPlanCode) {
    const { getPlanIdFromCode } = await import("@/lib/stripe/plan-utils");

    const previousPlanId = getPlanIdFromCode(subscription.existingPlanCode);
    const newPlanId = planId;

    if (previousPlanId) {
      console.log(
        `📋 Plan changed during checkout: ${previousPlanId} → ${newPlanId}`
      );

      const { publishPlanChanged } = await import("@/lib/subscription-events");

      publishPlanChanged(subscription.licenseKeyValue, {
        previousPlanId,
        newPlanId,
        newFeatures: plan.features.features,
        effectiveAt: new Date(),
      });
    }
  }

  // =========================================================================
  // CREATE PAYMENT RECORD
  // Payment records should be created for all paid subscriptions.
  // Primary: invoice.payment_succeeded webhook (handles most cases)
  // Fallback: Create here if invoice is already paid during checkout
  // =========================================================================
  if (session.payment_intent && !session.subscription) {
    // One-time payment - create payment record now
    await createPaymentFromCheckoutSession(
      customer.id,
      subscription.id,
      session,
      currentPeriodStart,
      currentPeriodEnd,
      price
    );
  } else if (session.subscription) {
    // For subscriptions, try to get the latest invoice and create payment if already paid
    try {
      const latestInvoiceId = stripeSubscription.latest_invoice;
      if (latestInvoiceId && typeof latestInvoiceId === "string") {
        const invoice = (await stripe.invoices.retrieve(
          latestInvoiceId
        )) as unknown as StripeInvoiceData;

        const paymentIntentId =
          typeof invoice.payment_intent === "string"
            ? invoice.payment_intent
            : (invoice.payment_intent as { id?: string } | null)?.id || null;

        // Create payment record if invoice is paid (even without payment_intent)
        // This handles cases where invoice.payment_succeeded webhook didn't fire
        if (invoice.status === "paid") {
          // Use payment_intent if available, otherwise use invoice ID for idempotency
          const stripePaymentId = paymentIntentId || invoice.id;

          await createPaymentFromInvoice(
            customer.id,
            subscription.id,
            {
              id: invoice.id,
              amount_paid: invoice.amount_paid || invoice.total || 0,
              amount_due: invoice.amount_due || 0,
              currency: invoice.currency,
              payment_intent: stripePaymentId, // Use invoice ID as fallback
              hosted_invoice_url: invoice.hosted_invoice_url,
              period_start: invoice.period_start,
              period_end: invoice.period_end,
            },
            "completed"
          );
          console.log(
            `✅ Payment record created from invoice ${invoice.id} during checkout`
          );
        } else if (invoice.status === "open" && invoice.amount_paid > 0) {
          // Handle partially paid invoices
          const stripePaymentId = paymentIntentId || invoice.id;

          await createPaymentFromInvoice(
            customer.id,
            subscription.id,
            {
              id: invoice.id,
              amount_paid: invoice.amount_paid,
              amount_due: invoice.amount_due || 0,
              currency: invoice.currency,
              payment_intent: stripePaymentId,
              hosted_invoice_url: invoice.hosted_invoice_url,
              period_start: invoice.period_start,
              period_end: invoice.period_end,
            },
            "completed"
          );
          console.log(
            `✅ Payment record created from partially paid invoice ${invoice.id}`
          );
        } else {
          console.log(
            `Invoice ${invoice.id} is ${invoice.status}, payment will be created when invoice is paid via webhook`
          );
        }
      }
    } catch (error) {
      console.warn(
        "Could not retrieve invoice for payment record creation:",
        error
      );
      // If we can't get the invoice, try to create a payment record using subscription data
      // This is a last resort fallback
      try {
        if (
          stripeSubscription.status === "active" &&
          !stripeSubscription.trial_end
        ) {
          // Only create if subscription is active and not in trial
          console.log(
            "Creating payment record from subscription data (fallback - invoice retrieval failed)"
          );
          await createPaymentFromCheckoutSession(
            customer.id,
            subscription.id,
            {
              amount_total: session.amount_total || price * 100, // Convert to cents
              currency: session.currency || "usd",
              payment_intent: session.payment_intent || null,
              metadata: session.metadata,
            },
            currentPeriodStart,
            currentPeriodEnd,
            price
          );
        }
      } catch (fallbackError) {
        console.warn(
          "Fallback payment record creation also failed:",
          fallbackError
        );
      }
    }
  }

  // =========================================================================
  // SYNC PAYMENT METHODS FROM STRIPE
  // When a checkout is completed, Stripe automatically attaches the payment
  // method to the customer. We need to sync it to our database.
  // =========================================================================
  try {
    const stripeCustomerId = stripeSubscription.customer as string;
    const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId);

    // Get all payment methods for this customer
    const paymentMethodsList = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: "card",
    });

    // Get default payment method ID
    const defaultPaymentMethodId = (stripeCustomer as Stripe.Customer)
      .invoice_settings?.default_payment_method;

    // Sync each payment method to database
    for (const pm of paymentMethodsList.data) {
      const baseData = {
        customerId: customer.id,
        stripePaymentMethodId: pm.id,
        stripeCustomerId: stripeCustomerId,
        type: pm.type,
        isActive: true,
      };

      const pmData =
        pm.type === "card" && pm.card
          ? {
              ...baseData,
              brand: pm.card.brand,
              last4: pm.card.last4,
              expMonth: pm.card.exp_month,
              expYear: pm.card.exp_year,
              funding: pm.card.funding || null,
              country: pm.card.country || null,
            }
          : baseData;

      // Check if this is the default payment method
      const isDefault =
        typeof defaultPaymentMethodId === "string"
          ? defaultPaymentMethodId === pm.id
          : defaultPaymentMethodId?.id === pm.id;

      // If this is default, unset other defaults first
      if (isDefault) {
        await db
          .update(paymentMethods)
          .set({ isDefault: false })
          .where(eq(paymentMethods.customerId, customer.id));
      }

      // Upsert payment method
      await db
        .insert(paymentMethods)
        .values({ ...pmData, isDefault })
        .onConflictDoUpdate({
          target: paymentMethods.stripePaymentMethodId,
          set: { ...pmData, isDefault, updatedAt: new Date() },
        });
    }

    if (paymentMethodsList.data.length > 0) {
      console.log(
        `✅ Synced ${paymentMethodsList.data.length} payment method(s) from checkout`
      );
    }
  } catch (error) {
    // Don't fail the entire checkout if payment method sync fails
    // The webhook handler will catch it later, or manual sync can be used
    console.warn(
      "Failed to sync payment methods during checkout (non-critical):",
      error
    );
  }

  console.log(
    `✅ Subscription created: ${subscription.id}, License: ${licenseKeyValue}`
  );
}

export async function handleSubscriptionUpdated(
  subscription: StripeSubscriptionData
) {
  const stripeSubscriptionId = subscription.id;

  console.log(
    `🔄 Processing subscription update: ${stripeSubscriptionId} (status: ${
      subscription.status
    }, trial_end: ${
      subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : "null"
    })`
  );

  // Find subscription by Stripe ID
  const [existingSubscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  if (!existingSubscription) return;

  const previousStatus = existingSubscription.status;
  const newStatus = subscription.status;

  // Determine internal status
  const internalStatus =
    subscription.status === "active"
      ? "active"
      : subscription.status === "trialing"
      ? "trialing"
      : subscription.status === "past_due"
      ? "past_due"
      : "cancelled";

  // Track trial_end changes for logging
  const previousTrialEnd = existingSubscription.trialEnd;
  const newTrialEnd =
    subscription.trial_end && subscription.trial_end > 0
      ? new Date(subscription.trial_end * 1000)
      : null;

  if (
    previousTrialEnd?.getTime() !== newTrialEnd?.getTime() &&
    (previousTrialEnd || newTrialEnd)
  ) {
    console.log(
      `📅 Trial end date updated: ${
        previousTrialEnd?.toISOString() || "null"
      } → ${newTrialEnd?.toISOString() || "null"}`
    );
  }

  // Execute DB updates in transaction
  const result = await withTransaction(async (tx) => {
    // Update subscription - safely handle dates
    await tx
      .update(subscriptions)
      .set({
        status: internalStatus,
        currentPeriodStart:
          subscription.current_period_start &&
          subscription.current_period_start > 0
            ? new Date(subscription.current_period_start * 1000)
            : existingSubscription.currentPeriodStart, // Keep existing if undefined
        currentPeriodEnd:
          subscription.current_period_end && subscription.current_period_end > 0
            ? new Date(subscription.current_period_end * 1000)
            : existingSubscription.currentPeriodEnd, // Keep existing if undefined
        nextBillingDate:
          subscription.current_period_end && subscription.current_period_end > 0
            ? new Date(subscription.current_period_end * 1000)
            : existingSubscription.nextBillingDate, // Keep existing if undefined
        trialEnd: newTrialEnd,
        trialStart:
          subscription.trial_start && subscription.trial_start > 0
            ? new Date(subscription.trial_start * 1000)
            : existingSubscription.trialStart || null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existingSubscription.id));

    // License Reactivation Logic
    const wasInactive = previousStatus
      ? ["cancelled", "past_due"].includes(previousStatus)
      : false;
    const isNowActive = ["active", "trialing"].includes(newStatus);

    let reactivatedLicenses: (typeof licenseKeys.$inferSelect)[] = [];

    if (wasInactive && isNowActive) {
      // Reactivate previously revoked licenses
      reactivatedLicenses = await tx
        .update(licenseKeys)
        .set({
          isActive: true,
          revokedAt: null,
          revocationReason: null,
        })
        .where(
          and(
            eq(licenseKeys.subscriptionId, existingSubscription.id),
            eq(licenseKeys.isActive, false)
          )
        )
        .returning();

      if (reactivatedLicenses.length > 0) {
        console.log(
          `✅ Reactivated ${reactivatedLicenses.length} license(s) for subscription ${existingSubscription.id}`
        );

        // Log reactivation
        await tx.insert(subscriptionChanges).values({
          subscriptionId: existingSubscription.id,
          customerId: existingSubscription.customerId,
          changeType: "license_reactivated",
          reason: `Subscription restored from ${previousStatus} to ${newStatus}`,
          effectiveDate: new Date(),
          createdAt: new Date(),
          metadata: {
            previousStatus,
            newStatus,
            reactivatedLicenseCount: reactivatedLicenses.length,
            licenseKeys: reactivatedLicenses.map((l) => l.id),
          },
        });
      }
    }

    // Status Change Logging
    let statusChanged = false;
    if (previousStatus !== newStatus) {
      statusChanged = true;
      await tx.insert(subscriptionChanges).values({
        subscriptionId: existingSubscription.id,
        customerId: existingSubscription.customerId,
        changeType: "status_change",
        reason: `Status changed from ${previousStatus} to ${newStatus}`,
        effectiveDate: new Date(),
        createdAt: new Date(),
        metadata: { previousStatus, newStatus },
      });
    }

    return { reactivatedLicenses, statusChanged };
  });

  // =========================================================================
  // POST-TRANSACTION NOTIFICATIONS (SSE)
  // =========================================================================
  const { reactivatedLicenses, statusChanged } = result;

  // 1. Notify about license reactivation
  if (reactivatedLicenses.length > 0) {
    for (const license of reactivatedLicenses) {
      const planId = license.licenseKey.includes("-BAS-")
        ? "basic"
        : license.licenseKey.includes("-PRO-")
        ? "professional"
        : "enterprise";

      publishLicenseReactivated(license.licenseKey, {
        planId,
        features: getPlanFeatures(planId),
      });
    }
  }

  // 2. Notify about plan change (if price changed)
  const currentPriceId = subscription.items.data[0]?.price.id;
  const previousPriceId = existingSubscription.metadata?.stripePriceId as
    | string
    | undefined;

  if (currentPriceId && previousPriceId && currentPriceId !== previousPriceId) {
    // Plan changed - detect which plans
    const { getPlanIdFromPriceIdSafe } = await import(
      "@/lib/stripe/plan-utils"
    );

    const newPlanId = getPlanIdFromPriceIdSafe(currentPriceId);
    const previousPlanId = getPlanIdFromPriceIdSafe(previousPriceId);

    if (newPlanId && previousPlanId && newPlanId !== previousPlanId) {
      console.log(
        `📋 Plan changed: ${previousPlanId} → ${newPlanId} for subscription ${existingSubscription.id}`
      );

      const licenseKeysList = await getLicenseKeysForSubscription(
        existingSubscription.id
      );

      const { publishPlanChanged } = await import("@/lib/subscription-events");

      for (const licenseKey of licenseKeysList) {
        const { getPlan } = await import("@/lib/stripe/plans");
        const newPlan = await getPlan(newPlanId);

        publishPlanChanged(licenseKey, {
          previousPlanId,
          newPlanId,
          newFeatures: getPlanFeatures(newPlanId),
          effectiveAt: new Date(),
        });
      }
    }
  }

  // 3. Notify about status change
  if (statusChanged) {
    const licenseKeysList = await getLicenseKeysForSubscription(
      existingSubscription.id
    );

    const shouldDisable = ["cancelled", "past_due"].includes(internalStatus);
    const gracePeriodRemaining = shouldDisable
      ? (internalStatus === "cancelled" ? 7 : 3) * 24 * 60 * 60 * 1000
      : null;

    for (const licenseKey of licenseKeysList) {
      publishSubscriptionUpdated(licenseKey, {
        previousStatus: previousStatus || "unknown",
        newStatus: internalStatus,
        shouldDisable,
        gracePeriodRemaining,
        trialEnd: newTrialEnd?.toISOString() || null, // Include trial end date
      });
    }
  }
}

export async function handleSubscriptionDeleted(
  subscription: StripeSubscriptionData
) {
  const stripeSubscriptionId = subscription.id;

  // Find subscription
  const [existingSubscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  if (!existingSubscription) return;

  // Execute DB updates in transaction
  const licensesToRevoke = await withTransaction(async (tx) => {
    // Update subscription status
    await tx
      .update(subscriptions)
      .set({
        status: "cancelled",
        canceledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existingSubscription.id));

    // Get active license keys before revoking
    const licenses = await tx
      .select({ licenseKey: licenseKeys.licenseKey })
      .from(licenseKeys)
      .where(
        and(
          eq(licenseKeys.subscriptionId, existingSubscription.id),
          eq(licenseKeys.isActive, true)
        )
      );

    // Revoke license keys
    await tx
      .update(licenseKeys)
      .set({
        isActive: false,
        revokedAt: new Date(),
        revocationReason: "Subscription cancelled",
      })
      .where(eq(licenseKeys.subscriptionId, existingSubscription.id));

    // Log change
    await tx.insert(subscriptionChanges).values({
      subscriptionId: existingSubscription.id,
      customerId: existingSubscription.customerId,
      changeType: "cancellation",
      reason: "Subscription deleted in Stripe",
      effectiveDate: new Date(),
      createdAt: new Date(),
    });

    return licenses;
  });

  // =========================================================================
  // POST-TRANSACTION NOTIFICATIONS (SSE)
  // =========================================================================
  const gracePeriodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days grace

  for (const license of licensesToRevoke) {
    // Send BOTH cancellation and revocation events
    publishSubscriptionCancelled(license.licenseKey, {
      cancelledAt: new Date(),
      cancelImmediately: true,
      gracePeriodEnd,
      reason: "Subscription deleted in Stripe",
    });

    publishLicenseRevoked(license.licenseKey, {
      reason: "Subscription cancelled - immediate deactivation",
    });
  }
}

export async function handlePaymentSucceeded(invoice: StripeInvoiceData) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  const subId =
    typeof subscriptionId === "string" ? subscriptionId : subscriptionId.id;

  // Find subscription
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subId))
    .limit(1);

  if (!subscription) return;

  const previousStatus = subscription.status;

  // Execute DB updates in transaction
  await withTransaction(async (tx) => {
    // Update subscription to active
    await tx
      .update(subscriptions)
      .set({
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id));

    // Create payment record (with idempotency check) inside transaction
    await createPaymentFromInvoice(
      subscription.customerId,
      subscription.id,
      {
        id: invoice.id,
        amount_paid: invoice.amount_paid,
        amount_due: invoice.amount_due,
        currency: invoice.currency,
        payment_intent:
          typeof invoice.payment_intent === "string"
            ? invoice.payment_intent
            : invoice.payment_intent?.id ?? null,
        hosted_invoice_url: invoice.hosted_invoice_url,
        period_start: invoice.period_start,
        period_end: invoice.period_end,
      },
      "completed",
      tx
    );

    return true;
  });

  // 🔔 SSE: Notify desktop apps if status changed from past_due to active
  if (previousStatus === "past_due") {
    const licenseKeysList = await getLicenseKeysForSubscription(
      subscription.id
    );

    for (const licenseKey of licenseKeysList) {
      publishPaymentSucceeded(licenseKey, {
        amount: invoice.amount_paid,
        currency: invoice.currency.toUpperCase(),
        subscriptionStatus: "active",
      });

      // Also send subscription reactivated event
      publishSubscriptionReactivated(licenseKey, {
        subscriptionStatus: "active",
        planId: subscription.planId || "basic",
      });
    }
  }
}

export async function handlePaymentFailed(invoice: StripeInvoiceData) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  const subId =
    typeof subscriptionId === "string" ? subscriptionId : subscriptionId.id;

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subId))
    .limit(1);

  if (!subscription) return;

  const previousStatus = subscription.status;

  // Execute DB updates in transaction
  await withTransaction(async (tx) => {
    // Update subscription to past_due
    await tx
      .update(subscriptions)
      .set({
        status: "past_due",
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.stripeSubscriptionId, subId));

    // Create failed payment record (with idempotency check)
    await createPaymentFromInvoice(
      subscription.customerId,
      subscription.id,
      {
        id: invoice.id,
        amount_paid: invoice.amount_paid,
        amount_due: invoice.amount_due,
        currency: invoice.currency,
        payment_intent:
          typeof invoice.payment_intent === "string"
            ? invoice.payment_intent
            : invoice.payment_intent?.id ?? null,
        hosted_invoice_url: invoice.hosted_invoice_url,
        period_start: invoice.period_start,
        period_end: invoice.period_end,
      },
      "failed",
      tx
    );

    // Log status change if status changed
    if (previousStatus !== "past_due") {
      await tx.insert(subscriptionChanges).values({
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        changeType: "status_change",
        reason: "Payment failed",
        effectiveDate: new Date(),
        createdAt: new Date(),
        metadata: {
          previousStatus,
          newStatus: "past_due",
          invoiceId: invoice.id,
          amountDue: invoice.amount_due,
        },
      });
    }

    return true;
  });

  // =========================================================================
  // POST-TRANSACTION NOTIFICATIONS (SSE)
  // =========================================================================

  // 🔔 SSE: Notify desktop apps about payment failure / past due status
  const licenseKeysList = await getLicenseKeysForSubscription(subscription.id);
  const pastDueGracePeriodEnd = new Date(
    Date.now() + 3 * 24 * 60 * 60 * 1000 // 3 days grace for past_due
  );

  for (const licenseKey of licenseKeysList) {
    publishSubscriptionPastDue(licenseKey, {
      pastDueSince: new Date(),
      gracePeriodEnd: pastDueGracePeriodEnd,
      amountDue: invoice.amount_due,
      currency: invoice.currency.toUpperCase(),
    });

    // Also send status update if it changed
    if (previousStatus !== "past_due") {
      publishSubscriptionUpdated(licenseKey, {
        previousStatus: previousStatus || "unknown",
        newStatus: "past_due",
        shouldDisable: true,
        gracePeriodRemaining: 3 * 24 * 60 * 60 * 1000,
      });
    }
  }
}

export async function handleCustomerUpdated(customer: StripeCustomerData) {
  const stripeCustomerId = customer.id;

  // Find customer by Stripe ID
  const [existingCustomer] = await db
    .select()
    .from(customers)
    .where(eq(customers.stripeCustomerId, stripeCustomerId))
    .limit(1);

  if (!existingCustomer) {
    console.warn(
      `Customer update webhook received for non-existent customer: ${stripeCustomerId}`
    );
    return;
  }

  // Update customer record with Stripe data
  await db
    .update(customers)
    .set({
      email: customer.email || existingCustomer.email,
      companyName: customer.name || existingCustomer.companyName,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, existingCustomer.id));

  // Sync default payment method changes from Stripe Dashboard
  try {
    const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId);
    const defaultPaymentMethodId = (stripeCustomer as Stripe.Customer)
      .invoice_settings?.default_payment_method;

    if (defaultPaymentMethodId) {
      // Unset all payment methods as non-default
      await db
        .update(paymentMethods)
        .set({ isDefault: false })
        .where(eq(paymentMethods.customerId, existingCustomer.id));

      // Set the new default payment method
      const defaultPmId =
        typeof defaultPaymentMethodId === "string"
          ? defaultPaymentMethodId
          : defaultPaymentMethodId.id;

      await db
        .update(paymentMethods)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(
          and(
            eq(paymentMethods.customerId, existingCustomer.id),
            eq(paymentMethods.stripePaymentMethodId, defaultPmId)
          )
        );

      console.log(
        `✅ Updated default payment method for customer ${existingCustomer.id}`
      );
    }
  } catch (error) {
    console.warn(
      "Failed to sync default payment method on customer update:",
      error
    );
  }

  console.log(
    `✅ Customer updated from Stripe: ${existingCustomer.id} (${customer.email})`
  );
}

export async function handleCustomerDeleted(customer: StripeCustomerData) {
  const stripeCustomerId = customer.id;

  // Find customer by Stripe ID
  const [existingCustomer] = await db
    .select()
    .from(customers)
    .where(eq(customers.stripeCustomerId, stripeCustomerId))
    .limit(1);

  if (!existingCustomer) {
    console.warn(
      `Customer deletion webhook received for non-existent customer: ${stripeCustomerId}`
    );
    return;
  }

  // Get active subscriptions BEFORE deletion to cancel them in Stripe
  const activeSubscriptions = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.customerId, existingCustomer.id),
        sql`${subscriptions.status} NOT IN ('cancelled', 'deleted')`
      )
    );

  // Cancel active subscriptions in Stripe first
  for (const subscription of activeSubscriptions) {
    if (subscription.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        console.log(
          `[Customer Deleted] Cancelled Stripe subscription: ${subscription.stripeSubscriptionId}`
        );
      } catch (error) {
        console.error(
          `Failed to cancel Stripe subscription ${subscription.stripeSubscriptionId}:`,
          error
        );
        // Continue anyway - will be marked as cancelled in our DB
      }
    }
  }

  // Get all active license keys BEFORE revoking them (for SSE notifications)
  const activeLicenses = await db
    .select()
    .from(licenseKeys)
    .where(
      and(
        eq(licenseKeys.customerId, existingCustomer.id),
        eq(licenseKeys.isActive, true)
      )
    );

  // Use transaction to ensure all operations succeed or fail together
  await withTransaction(async (tx) => {
    // Soft delete customer - ONLY when Stripe customer is actually deleted
    console.log(
      `[Customer Deletion] Marking customer as deleted in database: ${existingCustomer.id}`
    );
    await tx
      .update(customers)
      .set({
        status: "deleted",
        stripeCustomerId: null, // Unlink from Stripe
        updatedAt: new Date(),
      })
      .where(eq(customers.id, existingCustomer.id));

    // Cancel all active subscriptions in DB
    await tx
      .update(subscriptions)
      .set({
        status: "cancelled",
        canceledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(subscriptions.customerId, existingCustomer.id),
          sql`${subscriptions.status} NOT IN ('cancelled', 'deleted')`
        )
      );

    // Revoke all active license keys
    await tx
      .update(licenseKeys)
      .set({
        isActive: false,
        revokedAt: new Date(),
        revocationReason: "Customer deleted in Stripe",
      })
      .where(
        and(
          eq(licenseKeys.customerId, existingCustomer.id),
          eq(licenseKeys.isActive, true)
        )
      );

    console.log(
      `✅ [Customer Deletion] Complete: customer=${existingCustomer.id}, subscriptions cancelled, licenses revoked`
    );
  });

  // 🔔 CRITICAL: Send SSE events to notify all desktop apps to stop working immediately
  console.log(
    `[Customer Deletion] Sending license revocation events to ${activeLicenses.length} desktop app(s)`
  );
  for (const license of activeLicenses) {
    publishLicenseRevoked(license.licenseKey, {
      reason: "Customer deleted - immediate deactivation required",
    });
    console.log(
      `[SSE] Sent license_revoked event for license ${license.licenseKey}`
    );
  }

  console.log(
    `📢 [Customer Deletion] Notified ${activeLicenses.length} desktop app(s) of customer deletion`
  );
}

// ============================================================================
// PAYMENT METHOD HANDLERS
// ============================================================================

export async function handlePaymentMethodAttached(
  paymentMethod: StripePaymentMethodData,
  retryCount = 0
) {
  const stripeCustomerId =
    typeof paymentMethod.customer === "string"
      ? paymentMethod.customer
      : paymentMethod.customer.id;

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.stripeCustomerId, stripeCustomerId))
    .limit(1);

  if (!customer) {
    // Retry logic: Customer might be created shortly after payment method is attached
    // This can happen during checkout when events arrive out of order
    if (retryCount < 3) {
      const delayMs = 2000 * (retryCount + 1); // 2s, 4s, 6s
      console.log(
        `Payment method attached for customer ${stripeCustomerId} not found, retrying in ${delayMs}ms (attempt ${
          retryCount + 1
        }/3)`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return handlePaymentMethodAttached(paymentMethod, retryCount + 1);
    }
    console.error(
      `Payment method attached for unknown customer after ${retryCount} retries: ${stripeCustomerId}. Manual sync may be required.`
    );
    return;
  }

  const baseData = {
    customerId: customer.id,
    stripePaymentMethodId: paymentMethod.id,
    stripeCustomerId: stripeCustomerId,
    type: paymentMethod.type,
    isActive: true,
  };

  const pmData =
    paymentMethod.type === "card" && paymentMethod.card
      ? {
          ...baseData,
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          expMonth: paymentMethod.card.exp_month,
          expYear: paymentMethod.card.exp_year,
          funding: paymentMethod.card.funding,
          country: paymentMethod.card.country,
        }
      : baseData;

  // Check if this is the default payment method
  const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId);
  const isDefault =
    (stripeCustomer as Stripe.Customer).invoice_settings
      ?.default_payment_method === paymentMethod.id;

  // Use transaction to ensure atomic updates (prevent race conditions)
  await withTransaction(async (tx) => {
    // If this is default, unset other defaults first
    if (isDefault) {
      await tx
        .update(paymentMethods)
        .set({ isDefault: false })
        .where(eq(paymentMethods.customerId, customer.id));
    }

    // Upsert payment method
    await tx
      .insert(paymentMethods)
      .values({ ...pmData, isDefault })
      .onConflictDoUpdate({
        target: paymentMethods.stripePaymentMethodId,
        set: { ...pmData, isDefault, updatedAt: new Date() },
      });
  });

  console.log(
    `✅ Payment method synced: ${paymentMethod.id} (${paymentMethod.type})`
  );
}

export async function handlePaymentMethodDetached(
  paymentMethod: StripePaymentMethodData
) {
  await db
    .update(paymentMethods)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(paymentMethods.stripePaymentMethodId, paymentMethod.id));

  console.log(`✅ Payment method deactivated: ${paymentMethod.id}`);
}

// ============================================================================
// INVOICE HANDLERS
// ============================================================================

export async function handleInvoiceCreatedOrUpdated(
  invoice: StripeInvoiceData
) {
  const stripeCustomerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer.id;

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.stripeCustomerId, stripeCustomerId))
    .limit(1);

  if (!customer) {
    console.warn(`Invoice event for unknown customer: ${stripeCustomerId}`);
    return;
  }

  // Find subscription if exists
  let subscriptionId: string | null = null;
  if (invoice.subscription) {
    const subId =
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription.id;
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subId))
      .limit(1);
    subscriptionId = sub?.id || null;
  }

  // Upsert invoice
  await db
    .insert(invoices)
    .values({
      customerId: customer.id,
      subscriptionId,
      stripeInvoiceId: invoice.id,
      stripeCustomerId: stripeCustomerId,
      stripeSubscriptionId:
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id || null,
      number: invoice.number || null,
      status: invoice.status || "open",
      subtotal: invoice.subtotal || 0,
      tax: invoice.tax || 0,
      total: invoice.total || 0,
      amountDue: invoice.amount_due || 0,
      amountPaid: invoice.amount_paid || 0,
      amountRemaining: invoice.amount_remaining || 0,
      currency: invoice.currency || "usd",
      hostedInvoiceUrl: invoice.hosted_invoice_url || null,
      invoicePdf: invoice.invoice_pdf || null,
      periodStart:
        invoice.period_start && invoice.period_start > 0
          ? new Date(invoice.period_start * 1000)
          : null,
      periodEnd:
        invoice.period_end && invoice.period_end > 0
          ? new Date(invoice.period_end * 1000)
          : null,
      dueDate:
        invoice.due_date && invoice.due_date > 0
          ? new Date(invoice.due_date * 1000)
          : null,
      paidAt:
        invoice.status === "paid" && invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : null,
      description: invoice.description || null,
      metadata: (invoice.metadata as Record<string, unknown>) || null,
    })
    .onConflictDoUpdate({
      target: invoices.stripeInvoiceId,
      set: {
        status: invoice.status || "open",
        amountPaid: invoice.amount_paid || 0,
        amountRemaining: invoice.amount_remaining || 0,
        paidAt:
          invoice.status === "paid" && invoice.status_transitions?.paid_at
            ? new Date(invoice.status_transitions.paid_at * 1000)
            : null,
        updatedAt: new Date(),
      },
    });

  console.log(`✅ Invoice synced: ${invoice.id} (${invoice.status})`);
}

export async function handleInvoicePaid(invoice: StripeInvoiceData) {
  await db
    .update(invoices)
    .set({
      status: "paid",
      amountPaid: invoice.amount_paid || 0,
      amountRemaining: 0,
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(invoices.stripeInvoiceId, invoice.id));

  console.log(`✅ Invoice marked as paid: ${invoice.id}`);
}

export async function handleInvoicePaymentFailed(invoice: StripeInvoiceData) {
  await db
    .update(invoices)
    .set({
      status: "open",
      updatedAt: new Date(),
    })
    .where(eq(invoices.stripeInvoiceId, invoice.id));

  console.log(`⚠️ Invoice payment failed: ${invoice.id}`);
}
