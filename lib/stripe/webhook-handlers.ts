import { db } from "@/lib/db";
import {
  customers,
  subscriptions,
  licenseKeys,
  subscriptionChanges,
} from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { generateLicenseKey, storeLicenseKey } from "@/lib/license/generator";
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
  subscription?: string | null;
  amount_paid: number;
  amount_due: number;
  currency: string;
  status?: Stripe.Invoice.Status | null;
  payment_intent?: string | Stripe.PaymentIntent | null;
  hosted_invoice_url?: string | null;
  period_start: number;
  period_end: number;
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

  const plan = await getPlan(planId);
  const price =
    billingCycle === "monthly" ? plan.priceMonthly : plan.priceAnnual;

  // Calculate billing period dates
  const currentPeriodStart = new Date(
    stripeSubscription.current_period_start * 1000
  );
  const currentPeriodEnd = new Date(
    stripeSubscription.current_period_end * 1000
  );
  const trialEnd = stripeSubscription.trial_end
    ? new Date(stripeSubscription.trial_end * 1000)
    : null;
  const trialStart = stripeSubscription.trial_start
    ? new Date(stripeSubscription.trial_start * 1000)
    : null;

  // Plan code mapping for license key prefix
  const PLAN_CODES: Record<string, string> = {
    basic: "BAS",
    professional: "PRO",
    enterprise: "ENT",
  };

  // Use transaction for subscription creation + license management + audit logging
  const { subscription, licenseKeyValue } = await withTransaction(async (tx) => {
    // Create subscription record
    const [subscriptionRecord] = await tx
      .insert(subscriptions)
      .values({
        customerId: customer.id,
        planId,
        planType: planId, // Keep for backward compatibility
        billingCycle,
        price: price.toString(),
        status: stripeSubscription.status === "trialing" ? "trialing" : "active",
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
        `[Webhook] Reusing existing license: ${licenseKey.substring(0, 15)}...`
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

    return { subscription: subscriptionRecord, licenseKeyValue: licenseKey };
  });

  // For subscription checkouts, payment records are typically created via invoice.payment_succeeded webhook
  // However, if the invoice is already paid, create the payment record now as a fallback
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
        if (invoice.status === "paid" && paymentIntentId) {
          await createPaymentFromInvoice(
            customer.id,
            subscription.id,
            {
              id: invoice.id,
              amount_paid: invoice.amount_paid,
              amount_due: invoice.amount_due,
              currency: invoice.currency,
              payment_intent: paymentIntentId,
              hosted_invoice_url: invoice.hosted_invoice_url,
              period_start: invoice.period_start,
              period_end: invoice.period_end,
            },
            "completed"
          );
          console.log(
            `Payment record created from invoice ${invoice.id} (fallback)`
          );
        }
      }
    } catch (error) {
      console.warn(
        "Could not retrieve invoice for payment record creation:",
        error
      );
    }
  }

  console.log(
    `✅ Subscription created: ${subscription.id}, License: ${licenseKeyValue}`
  );
}

export async function handleSubscriptionUpdated(subscription: StripeSubscriptionData) {
  const stripeSubscriptionId = subscription.id;

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

  // Execute DB updates in transaction
  const result = await withTransaction(async (tx) => {
    // Update subscription
    await tx
      .update(subscriptions)
      .set({
        status: internalStatus,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        nextBillingDate: new Date(subscription.current_period_end * 1000),
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
    
    let reactivatedLicenses: typeof licenseKeys.$inferSelect[] = [];

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

  // 2. Notify about status change
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
      });
    }
  }
}

export async function handleSubscriptionDeleted(subscription: StripeSubscriptionData) {
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
    publishSubscriptionCancelled(license.licenseKey, {
      cancelledAt: new Date(),
      cancelImmediately: true,
      gracePeriodEnd,
      reason: "Subscription deleted in Stripe",
    });
  }
}

export async function handlePaymentSucceeded(invoice: StripeInvoiceData) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  // Find subscription
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
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

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
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
      .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));

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

  // Use transaction to ensure all operations succeed or fail together
  await withTransaction(async (tx) => {
    // Soft delete customer
    await tx
      .update(customers)
      .set({
        status: "deleted",
        stripeCustomerId: null, // Unlink from Stripe
        updatedAt: new Date(),
      })
      .where(eq(customers.id, existingCustomer.id));

    // Cancel all active subscriptions
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
      `✅ Customer deleted: ${existingCustomer.id}, subscriptions cancelled, licenses revoked`
    );
  });
}
