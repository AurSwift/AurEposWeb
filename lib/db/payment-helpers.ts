import { db } from "./index";
import { payments } from "./schema";
import { eq } from "drizzle-orm";

// Transaction type - accepts any object with the same interface as db
// This allows both db and transaction objects to be passed
type DbOrTransaction = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface CreatePaymentData {
  customerId: string;
  subscriptionId?: string | null;
  paymentType: "subscription" | "one-time" | "refund" | "upgrade" | "downgrade";
  amount: string; // Decimal as string
  currency?: string;
  status: "pending" | "completed" | "failed" | "refunded";
  stripePaymentId?: string | null;
  invoiceUrl?: string | null;
  billingPeriodStart?: Date | null;
  billingPeriodEnd?: Date | null;
  paidAt?: Date | null;
}

/**
 * Creates a payment record with idempotency check
 * Prevents duplicate payments if called multiple times with same stripePaymentId
 * 
 * @param data Payment data
 * @param tx Optional transaction - if provided, uses transaction instead of direct db
 * @returns Created payment record or existing payment if duplicate
 */
export async function createPaymentRecord(
  data: CreatePaymentData,
  tx?: DbOrTransaction
): Promise<typeof payments.$inferSelect> {
  const dbInstance = tx || db;

  // Idempotency check: If stripePaymentId is provided, check if payment already exists
  if (data.stripePaymentId) {
    const [existingPayment] = await dbInstance
      .select()
      .from(payments)
      .where(eq(payments.stripePaymentId, data.stripePaymentId))
      .limit(1);

    if (existingPayment) {
      console.log(
        `Payment with stripePaymentId ${data.stripePaymentId} already exists, returning existing record`
      );
      return existingPayment;
    }
  }

  // Insert new payment record
  const [payment] = await dbInstance
    .insert(payments)
    .values({
      customerId: data.customerId,
      subscriptionId: data.subscriptionId || null,
      paymentType: data.paymentType,
      amount: data.amount,
      currency: data.currency || "USD",
      status: data.status,
      stripePaymentId: data.stripePaymentId || null,
      invoiceUrl: data.invoiceUrl || null,
      billingPeriodStart: data.billingPeriodStart || null,
      billingPeriodEnd: data.billingPeriodEnd || null,
      paidAt: data.paidAt || null,
      // createdAt is handled by defaultNow() in schema
    })
    .returning();

  return payment;
}

/**
 * Creates a payment record from Stripe checkout session
 */
export async function createPaymentFromCheckoutSession(
  customerId: string,
  subscriptionId: string,
  session: {
    amount_total?: number | null;
    currency?: string | null;
    payment_intent?: string | null;
    metadata?: Record<string, string>;
  },
  billingPeriodStart: Date,
  billingPeriodEnd: Date,
  fallbackAmount?: number
): Promise<typeof payments.$inferSelect> {
  const amount = session.amount_total
    ? (session.amount_total / 100).toString()
    : fallbackAmount
    ? fallbackAmount.toString()
    : "0";

  return createPaymentRecord({
    customerId,
    subscriptionId,
    paymentType: "subscription",
    amount,
    currency: (session.currency || "USD").toUpperCase(),
    status: "completed",
    stripePaymentId: session.payment_intent || null,
    billingPeriodStart,
    billingPeriodEnd,
    paidAt: new Date(),
  });
}

/**
 * Creates a payment record from Stripe invoice
 */
export async function createPaymentFromInvoice(
  customerId: string,
  subscriptionId: string,
  invoice: {
    id: string;
    amount_paid?: number;
    amount_due?: number;
    currency: string;
    payment_intent?: string | null;
    hosted_invoice_url?: string | null;
    period_start: number;
    period_end: number;
  },
  status: "completed" | "failed" = "completed"
): Promise<typeof payments.$inferSelect> {
  const amount = status === "completed"
    ? (invoice.amount_paid || 0) / 100
    : (invoice.amount_due || 0) / 100;

  return createPaymentRecord({
    customerId,
    subscriptionId,
    paymentType: "subscription",
    amount: amount.toString(),
    currency: invoice.currency.toUpperCase(),
    status,
    stripePaymentId: invoice.payment_intent || invoice.id, // Fallback to invoice ID if no payment intent
    invoiceUrl: invoice.hosted_invoice_url || null,
    billingPeriodStart: new Date(invoice.period_start * 1000),
    billingPeriodEnd: new Date(invoice.period_end * 1000),
    paidAt: status === "completed" ? new Date() : null,
  });
}

/**
 * Creates a proration payment record from plan change
 * 
 * @param customerId Customer ID
 * @param subscriptionId Subscription ID
 * @param prorationAmount Proration amount (positive for charges)
 * @param currency Currency code
 * @param billingPeriodStart Billing period start date
 * @param billingPeriodEnd Billing period end date
 * @param stripePaymentId Optional Stripe payment intent ID
 * @param invoiceUrl Optional invoice URL
 * @param tx Optional transaction - if provided, uses transaction instead of direct db
 * @returns Created payment record or null if proration amount is <= 0
 */
export async function createProrationPayment(
  customerId: string,
  subscriptionId: string,
  prorationAmount: number,
  currency: string,
  billingPeriodStart: Date,
  billingPeriodEnd: Date,
  stripePaymentId?: string | null,
  invoiceUrl?: string | null,
  tx?: DbOrTransaction
): Promise<typeof payments.$inferSelect | null> {
  // Only create payment if proration amount is positive (charge)
  // For negative amounts (credits), consider creating a separate credit record
  if (prorationAmount <= 0) {
    console.log(
      `Proration amount is ${prorationAmount}, skipping payment record (consider creating credit record)`
    );
    return null;
  }

  return createPaymentRecord(
    {
      customerId,
      subscriptionId,
      paymentType: "upgrade",
      amount: prorationAmount.toString(),
      currency: currency.toUpperCase(),
      status: "completed",
      stripePaymentId: stripePaymentId || null,
      invoiceUrl: invoiceUrl || null,
      billingPeriodStart,
      billingPeriodEnd,
      paidAt: new Date(),
    },
    tx
  );
}

