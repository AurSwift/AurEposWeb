import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { db } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import {
  shouldRetryError,
  logWebhookError,
  markWebhookSuccess,
  getWebhookErrorStatus,
} from "@/lib/stripe/webhook-helpers";
import {
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handlePaymentSucceeded,
  handlePaymentFailed,
  handleCustomerUpdated,
  handleCustomerDeleted,
  type CheckoutSessionData,
  type StripeSubscriptionData,
  type StripeInvoiceData,
  type StripeCustomerData,
} from "@/lib/stripe/webhook-handlers";

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

  // =========================================================================
  // IDEMPOTENCY CHECK WITH PROPER CONFLICT HANDLING
  // Uses ON CONFLICT DO NOTHING to atomically check and insert
  // =========================================================================
  try {
    // Try to insert the event - if it already exists, this will return empty array
    const [insertedEvent] = await db
      .insert(webhookEvents)
      .values({
        stripeEventId: event.id,
        eventType: event.type,
        metadata: event.data.object as unknown as Record<string, unknown>,
        processed: false, // Will be set to true after successful processing
      })
      .onConflictDoNothing({ target: webhookEvents.stripeEventId })
      .returning();

    if (!insertedEvent) {
      // Event was already processed (conflict on insert)
      console.log(
        `Webhook event ${event.id} already processed (idempotent skip)`
      );
      return NextResponse.json({ received: true });
    }
  } catch (error) {
    console.warn("Idempotency check failed:", error);
    // Continue processing - better to process twice than not at all if DB is flaky
  }

  try {
    console.log(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as CheckoutSessionData;
        await handleCheckoutCompleted(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data
          .object as unknown as StripeSubscriptionData;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data
          .object as unknown as StripeSubscriptionData;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as unknown as StripeInvoiceData;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as unknown as StripeInvoiceData;
        await handlePaymentFailed(invoice);
        break;
      }

      case "customer.updated": {
        const customer = event.data.object as StripeCustomerData;
        await handleCustomerUpdated(customer);
        break;
      }

      case "customer.deleted": {
        const customer = event.data.object as StripeCustomerData;
        await handleCustomerDeleted(customer);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark event as successfully processed
    await markWebhookSuccess(event.id);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`Webhook handler failed for ${event.type}:`, error);

    // Determine if error is retryable and log it
    const retryable = shouldRetryError(error);
    await logWebhookError(event.id, error, retryable);

    // Return appropriate status code
    const statusCode = getWebhookErrorStatus(error);
    return NextResponse.json(
      { 
        error: "Webhook handler failed",
        retryable 
      },
      { status: statusCode }
    );
  }
}
