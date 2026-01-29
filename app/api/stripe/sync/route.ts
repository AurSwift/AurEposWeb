import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth-helpers";
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";
import { successResponse, handleApiError } from "@/lib/api/response-helpers";
import { stripe } from "@/lib/stripe/client";
import { db } from "@/lib/db";
import { paymentMethods, invoices, subscriptions, payments } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import Stripe from "stripe";
import { createPaymentFromInvoice } from "@/lib/db/payment-helpers";

/**
 * POST /api/stripe/sync
 * Syncs existing payment methods and invoices from Stripe to database
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const customer = await getCustomerOrThrow(session.user.id);

    if (!customer.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer ID found" },
        { status: 400 }
      );
    }

    const stripeCustomerId = customer.stripeCustomerId;

    // Sync payment methods
    const paymentMethodsList = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: "card",
    });

    let syncedPaymentMethods = 0;
    let syncedInvoices = 0;
    let syncedPayments = 0;

    // Get default payment method from customer
    const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId);
    const defaultPaymentMethodId =
      (stripeCustomer as Stripe.Customer).invoice_settings
        ?.default_payment_method;

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

      await db
        .insert(paymentMethods)
        .values({ ...pmData, isDefault })
        .onConflictDoUpdate({
          target: paymentMethods.stripePaymentMethodId,
          set: { ...pmData, isDefault, updatedAt: new Date() },
        });

      syncedPaymentMethods++;
    }

    // Sync invoices
    const invoicesList = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit: 100,
    });

    for (const invoice of invoicesList.data) {
      // Cast to any to access properties that exist at runtime but aren't in TypeScript definitions
      const invoiceAny = invoice as any;
      
      // Find subscription if exists
      let subscriptionId: string | null = null;
      const invoiceSubscription = invoiceAny.subscription as string | Stripe.Subscription | null | undefined;
      if (invoiceSubscription) {
        const subId =
          typeof invoiceSubscription === "string"
            ? invoiceSubscription
            : invoiceSubscription.id;
        const [sub] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.stripeSubscriptionId, subId))
          .limit(1);
        subscriptionId = sub?.id || null;
      }

      await db
        .insert(invoices)
        .values({
          customerId: customer.id,
          subscriptionId,
          stripeInvoiceId: invoice.id,
          stripeCustomerId: stripeCustomerId,
          stripeSubscriptionId:
            typeof invoiceSubscription === "string"
              ? invoiceSubscription
              : invoiceSubscription?.id || null,
          number: invoiceAny.number || null,
          status: invoiceAny.status || "open",
          subtotal: invoiceAny.subtotal || 0,
          tax: invoiceAny.tax || 0,
          total: invoiceAny.total || 0,
          amountDue: invoiceAny.amount_due || 0,
          amountPaid: invoiceAny.amount_paid || 0,
          amountRemaining: invoiceAny.amount_remaining || 0,
          currency: invoiceAny.currency || "usd",
          hostedInvoiceUrl: invoiceAny.hosted_invoice_url || null,
          invoicePdf: invoiceAny.invoice_pdf || null,
          periodStart:
            invoiceAny.period_start && invoiceAny.period_start > 0
              ? new Date(invoiceAny.period_start * 1000)
              : null,
          periodEnd:
            invoiceAny.period_end && invoiceAny.period_end > 0
              ? new Date(invoiceAny.period_end * 1000)
              : null,
          dueDate:
            invoiceAny.due_date && invoiceAny.due_date > 0
              ? new Date(invoiceAny.due_date * 1000)
              : null,
          paidAt:
            invoiceAny.status === "paid" && invoiceAny.status_transitions?.paid_at
              ? new Date(invoiceAny.status_transitions.paid_at * 1000)
              : null,
          description: invoiceAny.description || null,
          metadata: (invoiceAny.metadata as Record<string, unknown>) || null,
        })
        .onConflictDoUpdate({
          target: invoices.stripeInvoiceId,
          set: {
            status: invoiceAny.status || "open",
            amountPaid: invoiceAny.amount_paid || 0,
            amountRemaining: invoiceAny.amount_remaining || 0,
            paidAt:
              invoiceAny.status === "paid" && invoiceAny.status_transitions?.paid_at
                ? new Date(invoiceAny.status_transitions.paid_at * 1000)
                : null,
            updatedAt: new Date(),
          },
        });

      syncedInvoices++;

      // Create payment record for paid invoices that don't have a payment record yet
      if (invoiceAny.status === "paid" && invoiceAny.amount_paid > 0) {
        // Check if payment record already exists for this invoice
        const paymentIntentId =
          typeof invoiceAny.payment_intent === "string"
            ? invoiceAny.payment_intent
            : invoiceAny.payment_intent?.id || null;
        
        const stripePaymentId = paymentIntentId || invoice.id;
        
        // Check if payment record exists
        const [existingPayment] = await db
          .select()
          .from(payments)
          .where(eq(payments.stripePaymentId, stripePaymentId))
          .limit(1);

        if (!existingPayment && subscriptionId) {
          try {
            // Create payment record from invoice
            await createPaymentFromInvoice(
              customer.id,
              subscriptionId,
              {
                id: invoice.id,
                amount_paid: invoiceAny.amount_paid,
                amount_due: invoiceAny.amount_due || 0,
                currency: invoiceAny.currency,
                payment_intent: stripePaymentId,
                hosted_invoice_url: invoiceAny.hosted_invoice_url || null,
                period_start: invoiceAny.period_start,
                period_end: invoiceAny.period_end,
              },
              "completed"
            );
            syncedPayments++;
            console.log(
              `✅ Created payment record for invoice ${invoice.id} (backfill)`
            );
          } catch (error) {
            console.warn(
              `Failed to create payment record for invoice ${invoice.id}:`,
              error
            );
          }
        }
      }
    }

    return successResponse({
      message: "Sync completed successfully",
      syncedPaymentMethods,
      syncedInvoices,
      syncedPayments,
    });
  } catch (error) {
    console.error("Failed to sync Stripe data:", error);
    return handleApiError(error, "Failed to sync Stripe data");
  }
}

