import { NextRequest, NextResponse } from "next/server";
import { requireInternalUser } from "@/lib/api/auth-helpers";
import { handleApiError } from "@/lib/api/response-helpers";
import { db } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
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
import { markWebhookSuccess, logWebhookError } from "@/lib/stripe/webhook-helpers";

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication (Admin only)
    await requireInternalUser();

    // 2. Parse request
    const body = await request.json();
    const { eventIds } = body;

    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid eventIds provided" },
        { status: 400 }
      );
    }

    // 3. Retrieve events from DB
    const events = await db
      .select()
      .from(webhookEvents)
      .where(inArray(webhookEvents.stripeEventId, eventIds));

    if (events.length === 0) {
      return NextResponse.json(
        { message: "No events found for provided IDs", results: [] },
        { status: 200 }
      );
    }

    // 4. Process events
    const results = [];

    for (const event of events) {
      const result = {
        eventId: event.stripeEventId,
        type: event.eventType,
        success: false,
        message: "",
      };

      try {
        console.log(`[Replay] Processing event: ${event.eventType} (${event.stripeEventId})`);

        switch (event.eventType) {
          case "checkout.session.completed": {
            const session = event.metadata as unknown as CheckoutSessionData;
            await handleCheckoutCompleted(session);
            break;
          }

          case "customer.subscription.created":
          case "customer.subscription.updated": {
            const subscription = event.metadata as unknown as StripeSubscriptionData;
            await handleSubscriptionUpdated(subscription);
            break;
          }

          case "customer.subscription.deleted": {
            const subscription = event.metadata as unknown as StripeSubscriptionData;
            await handleSubscriptionDeleted(subscription);
            break;
          }

          case "invoice.payment_succeeded": {
            const invoice = event.metadata as unknown as StripeInvoiceData;
            await handlePaymentSucceeded(invoice);
            break;
          }

          case "invoice.payment_failed": {
            const invoice = event.metadata as unknown as StripeInvoiceData;
            await handlePaymentFailed(invoice);
            break;
          }

          case "customer.updated": {
            const customer = event.metadata as unknown as StripeCustomerData;
            await handleCustomerUpdated(customer);
            break;
          }

          case "customer.deleted": {
            const customer = event.metadata as unknown as StripeCustomerData;
            await handleCustomerDeleted(customer);
            break;
          }

          default:
            console.log(`[Replay] Unhandled event type: ${event.eventType}`);
            result.message = "Unhandled event type";
            // We consider unhandled types as "success" in replaying context 
            // if we just want to clear them, but technically we didn't do anything.
            // Let's mark as skipped.
        }

        // Mark as successful if we handled it
        await markWebhookSuccess(event.stripeEventId);
        result.success = true;
        result.message = "Replayed successfully";

      } catch (error) {
        console.error(`[Replay] Failed to process event ${event.stripeEventId}:`, error);
        await logWebhookError(event.stripeEventId, error, true); // Log as retryable simply to record error
        result.success = false;
        result.message = String(error);
      }

      results.push(result);
    }

    return NextResponse.json({
      success: true,
      processedCount: results.length,
      results,
    });

  } catch (error) {
    return handleApiError(error, "Failed to replay webhook events");
  }
}
