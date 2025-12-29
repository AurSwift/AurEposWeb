import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { db } from "@/lib/db";
import {
  customers,
  subscriptions,
  licenseKeys,
  webhookEvents,
  subscriptionChanges,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { generateLicenseKey, storeLicenseKey } from "@/lib/license/generator";
import { getPlan, type PlanId } from "@/lib/stripe/plans";
import {
  createPaymentFromCheckoutSession,
  createPaymentFromInvoice,
} from "@/lib/db/payment-helpers";
import Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  // Idempotency check
  try {
    const [existingEvent] = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.stripeEventId, event.id))
      .limit(1);

    if (existingEvent) {
      console.log(`Webhook event ${event.id} already processed`);
      return NextResponse.json({ received: true });
    }

    // Record event processing start
    await db.insert(webhookEvents).values({
      stripeEventId: event.id,
      eventType: event.type,
      metadata: event.data.object as any,
      processed: true,
    });
  } catch (error) {
    console.warn(
      "Idempotency check failed (possibly duplicate insert):",
      error
    );
    // Continue processing - better to process twice than not at all if DB is flaky
  }

  try {
    console.log(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        await handleCheckoutCompleted(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`Webhook handler failed for ${event.type}:`, error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: any) {
  const customerId = session.metadata?.customerId;
  const planId = session.metadata?.planId as PlanId;
  const billingCycle = session.metadata?.billingCycle as "monthly" | "annual";

  if (!customerId || !planId || !billingCycle) {
    console.warn("Missing metadata in checkout session, skipping fulfillment");
    return;
  }

  // Get subscription from Stripe
  const subscriptionId = session.subscription as string;
  if (!subscriptionId) {
    throw new Error("No subscription ID in checkout session");
  }

  const stripeSubscription = (await stripe.subscriptions.retrieve(
    subscriptionId
  )) as any;

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

  // Create subscription record
  const [subscription] = await db
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

  // Generate and store license key
  const licenseKey = generateLicenseKey(planId, customer.id);

  await storeLicenseKey(
    licenseKey,
    customer.id,
    subscription.id,
    planId,
    plan.features.maxTerminals
  );

  // For subscription checkouts, payment records are typically created via invoice.payment_succeeded webhook
  // However, if the invoice is already paid, create the payment record now as a fallback
  // Only create payment here if it's a one-time payment (not a subscription)
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
    // This is a fallback in case invoice.payment_succeeded already fired or doesn't fire
    try {
      const latestInvoiceId = stripeSubscription.latest_invoice;
      if (latestInvoiceId && typeof latestInvoiceId === "string") {
        const invoice = (await stripe.invoices.retrieve(
          latestInvoiceId
        )) as any;
        // Check if invoice is paid and has payment intent
        const paymentIntentId =
          typeof invoice.payment_intent === "string"
            ? invoice.payment_intent
            : invoice.payment_intent?.id || null;
        if (invoice.status === "paid" && paymentIntentId) {
          // Invoice is already paid - create payment record now
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
        } else {
          console.log(
            `Invoice ${invoice.id} not yet paid, payment record will be created when invoice.payment_succeeded fires`
          );
        }
      }
    } catch (error) {
      console.warn(
        "Could not retrieve invoice for payment record creation:",
        error
      );
      // Payment will be created when invoice.payment_succeeded fires
    }
  }

  // Log to subscription changes
  await db.insert(subscriptionChanges).values({
    subscriptionId: subscription.id,
    customerId: customer.id,
    changeType: "subscription_created",
    newPlanId: planId,
    newBillingCycle: billingCycle,
    newPrice: price.toString(),
    effectiveDate: new Date(),
    reason: "New subscription via checkout",
    createdAt: new Date(),
  });

  console.log(
    `✅ Subscription created: ${subscription.id}, License: ${licenseKey}`
  );
}

async function handleSubscriptionUpdated(subscription: any) {
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

  // Update subscription
  await db
    .update(subscriptions)
    .set({
      status:
        subscription.status === "active"
          ? "active"
          : subscription.status === "trialing"
          ? "trialing"
          : subscription.status === "past_due"
          ? "past_due"
          : "cancelled",
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

  // If status changed to past_due or canceled, log it
  if (previousStatus !== newStatus) {
    await db.insert(subscriptionChanges).values({
      subscriptionId: existingSubscription.id,
      customerId: existingSubscription.customerId,
      changeType: "status_change",
      reason: `Status changed from ${previousStatus} to ${newStatus}`,
      effectiveDate: new Date(),
      createdAt: new Date(),
      metadata: { previousStatus, newStatus },
    });
  }
}

async function handleSubscriptionDeleted(subscription: any) {
  const stripeSubscriptionId = subscription.id;

  // Find subscription
  const [existingSubscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  if (!existingSubscription) return;

  // Update subscription status
  await db
    .update(subscriptions)
    .set({
      status: "cancelled",
      canceledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, existingSubscription.id));

  // Revoke license keys
  await db
    .update(licenseKeys)
    .set({
      isActive: false,
      revokedAt: new Date(),
      revocationReason: "Subscription cancelled",
    })
    .where(eq(licenseKeys.subscriptionId, existingSubscription.id));

  // Log change
  await db.insert(subscriptionChanges).values({
    subscriptionId: existingSubscription.id,
    customerId: existingSubscription.customerId,
    changeType: "cancellation",
    reason: "Subscription deleted in Stripe",
    effectiveDate: new Date(),
    createdAt: new Date(),
  });
}

async function handlePaymentSucceeded(invoice: any) {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  // Find subscription
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (!subscription) return;

  // Update subscription to active
  await db
    .update(subscriptions)
    .set({
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscription.id));

  // Create payment record (with idempotency check)
  await createPaymentFromInvoice(
    subscription.customerId,
    subscription.id,
    invoice,
    "completed"
  );
}

async function handlePaymentFailed(invoice: any) {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (!subscription) return;

  // Update subscription to past_due
  await db
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
    invoice,
    "failed"
  );

  // Log status change
  await db.insert(subscriptionChanges).values({
    subscriptionId: subscription.id,
    customerId: subscription.customerId,
    changeType: "payment_failed",
    reason: "Payment failed for invoice",
    effectiveDate: new Date(),
    createdAt: new Date(),
    metadata: { invoiceId: invoice.id },
  });
}
