# Payment Table Instantiation Analysis

## Overview

This document analyzes how payment records are created and inserted into the `payments` table across the application.

## Payment Table Schema

```typescript
payments {
  id: uuid (primary key, auto-generated)
  customerId: uuid (required, references customers.id)
  subscriptionId: uuid (optional, references subscriptions.id, onDelete: set null)
  paymentType: varchar(20) // 'subscription', 'one-time', 'refund', 'upgrade'
  amount: decimal(10,2) (required)
  currency: varchar(3) (default: 'USD')
  status: varchar(20) // 'pending', 'completed', 'failed', 'refunded'
  stripePaymentId: varchar(100) (optional)
  invoiceUrl: text (optional)
  billingPeriodStart: timestamp (optional)
  billingPeriodEnd: timestamp (optional)
  paidAt: timestamp (optional)
  createdAt: timestamp (default: now())
}
```

## Payment Instantiation Locations

### 1. Webhook: Checkout Session Completed
**File**: `web/app/api/stripe/webhook/route.ts` (line 200)

**Trigger**: `checkout.session.completed` event

**Code**:
```typescript
await db.insert(payments).values({
  customerId: customer.id,
  subscriptionId: subscription.id,
  paymentType: "subscription",
  amount: (session.amount_total ? session.amount_total / 100 : price).toString(),
  currency: (session.currency || "USD").toUpperCase(),
  status: "completed",
  stripePaymentId: session.payment_intent as string,
  billingPeriodStart: currentPeriodStart,
  billingPeriodEnd: currentPeriodEnd,
  paidAt: new Date(),
  createdAt: new Date(),
});
```

**Analysis**:
- ✅ Creates payment for initial subscription purchase
- ⚠️ Uses `session.payment_intent` (may be null for some payment methods)
- ⚠️ Falls back to `price` if `session.amount_total` is missing
- ✅ Sets all required fields
- ❌ No idempotency check (could create duplicates if webhook fires twice)

---

### 2. Webhook: Invoice Payment Succeeded
**File**: `web/app/api/stripe/webhook/route.ts` (line 350)

**Trigger**: `invoice.payment_succeeded` event (recurring payments)

**Code**:
```typescript
await db.insert(payments).values({
  customerId: subscription.customerId,
  subscriptionId: subscription.id,
  paymentType: "subscription",
  amount: (invoice.amount_paid / 100).toString(),
  currency: invoice.currency.toUpperCase(),
  status: "completed",
  stripePaymentId: invoice.payment_intent as string,
  invoiceUrl: invoice.hosted_invoice_url,
  billingPeriodStart: new Date(invoice.period_start * 1000),
  billingPeriodEnd: new Date(invoice.period_end * 1000),
  paidAt: new Date(),
  createdAt: new Date(),
});
```

**Analysis**:
- ✅ Creates payment for recurring subscription payments
- ✅ Includes invoice URL
- ⚠️ Uses `invoice.payment_intent` (may be null for some payment methods)
- ❌ No idempotency check (could create duplicates)
- ❌ No check if payment already exists for this invoice

---

### 3. Webhook: Invoice Payment Failed
**File**: `web/app/api/stripe/webhook/route.ts` (line 388)

**Trigger**: `invoice.payment_failed` event

**Code**:
```typescript
await db.insert(payments).values({
  customerId: subscription.customerId,
  subscriptionId: subscription.id,
  paymentType: "subscription",
  amount: (invoice.amount_due / 100).toString(),
  currency: invoice.currency.toUpperCase(),
  status: "failed",
  stripePaymentId: invoice.payment_intent as string,
  billingPeriodStart: new Date(invoice.period_start * 1000),
  billingPeriodEnd: new Date(invoice.period_end * 1000),
  createdAt: new Date(),
  invoiceUrl: invoice.hosted_invoice_url,
});
```

**Analysis**:
- ✅ Records failed payment attempts
- ⚠️ Uses `invoice.amount_due` (amount that failed to charge)
- ⚠️ No `paidAt` (correct, since payment failed)
- ❌ No idempotency check
- ❌ Could create multiple failed payment records for same invoice

---

### 4. Plan Change: Proration Payment
**File**: `web/app/api/subscriptions/change-plan/route.ts` (line 170)

**Trigger**: User upgrades/downgrades subscription plan

**Code**:
```typescript
await tx.insert(payments).values({
  customerId: customer.id,
  subscriptionId,
  paymentType: "upgrade",
  amount: prorationAmount.toString(),
  currency: "USD",
  status: "completed",
  paidAt: new Date(),
  billingPeriodStart: new Date(updatedSubscription.current_period_start * 1000),
  billingPeriodEnd: new Date(updatedSubscription.current_period_end * 1000),
});
```

**Analysis**:
- ✅ Creates payment record for proration charges
- ✅ Uses transaction (`tx`) for atomicity
- ❌ Missing `stripePaymentId` (no Stripe payment intent ID)
- ❌ Missing `invoiceUrl`
- ⚠️ Hardcoded currency "USD" (should use subscription currency)
- ⚠️ Only creates payment if `prorationAmount > 0` (downgrades with credit not recorded)
- ❌ No idempotency check

---

## Issues Identified

### 1. **Missing Idempotency Checks**
**Problem**: No checks to prevent duplicate payment records if webhooks fire multiple times.

**Impact**: 
- Duplicate payment records in database
- Incorrect payment history
- Potential accounting discrepancies

**Solution**: Check if payment with same `stripePaymentId` already exists before inserting.

### 2. **Inconsistent Field Usage**
**Problem**: 
- Some payments include `createdAt` explicitly, others rely on default
- `stripePaymentId` may be null for some payment methods
- Missing `invoiceUrl` in some cases

**Impact**: Inconsistent data quality

### 3. **Missing Stripe Payment ID in Plan Changes**
**Problem**: Proration payments don't have `stripePaymentId` linked.

**Impact**: Can't trace proration payments back to Stripe

**Solution**: Retrieve invoice/payment intent from Stripe after subscription update.

### 4. **No Handling of Credits/Refunds**
**Problem**: When downgrading, credits are not recorded as negative payments or refunds.

**Impact**: Incomplete payment history

### 5. **Currency Hardcoding**
**Problem**: Plan change proration uses hardcoded "USD".

**Impact**: Won't work for international customers with different currencies

---

## Best Practices Recommendations

### 1. Add Idempotency Checks

```typescript
// Before inserting payment, check if it already exists
const existingPayment = await db
  .select()
  .from(payments)
  .where(eq(payments.stripePaymentId, stripePaymentId))
  .limit(1);

if (existingPayment.length > 0) {
  console.log(`Payment ${stripePaymentId} already exists, skipping`);
  return existingPayment[0];
}
```

### 2. Use Invoice ID for Idempotency

Stripe invoices have unique IDs. Use `invoice.id` as a secondary check:

```typescript
// Check by invoice ID if available
if (invoice.id) {
  const existing = await db
    .select()
    .from(payments)
    .where(eq(payments.stripePaymentId, invoice.id))
    .limit(1);
  // ...
}
```

### 3. Create Helper Function

```typescript
async function createPaymentRecord(data: {
  customerId: string;
  subscriptionId?: string;
  paymentType: string;
  amount: string;
  currency: string;
  status: string;
  stripePaymentId?: string;
  invoiceUrl?: string;
  billingPeriodStart?: Date;
  billingPeriodEnd?: Date;
  paidAt?: Date;
}) {
  // Idempotency check
  if (data.stripePaymentId) {
    const existing = await db
      .select()
      .from(payments)
      .where(eq(payments.stripePaymentId, data.stripePaymentId))
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0];
    }
  }

  // Insert payment
  const [payment] = await db
    .insert(payments)
    .values({
      ...data,
      createdAt: new Date(),
    })
    .returning();

  return payment;
}
```

### 4. Handle All Payment Types

- Record credits/refunds as negative amounts or separate refund records
- Record prorations with proper Stripe payment intent IDs
- Handle one-time payments (if applicable)

### 5. Use Transactions

All payment creation should be in transactions when part of larger operations (like subscription creation).

---

## Current Flow Summary

1. **Initial Purchase** → `checkout.session.completed` → Creates payment + subscription
2. **Recurring Payment** → `invoice.payment_succeeded` → Creates payment record
3. **Failed Payment** → `invoice.payment_failed` → Creates failed payment record
4. **Plan Change** → User action → Creates proration payment (if upgrade)

## Recommendations Priority

1. **HIGH**: Add idempotency checks to prevent duplicates
2. **HIGH**: Add `stripePaymentId` to proration payments
3. **MEDIUM**: Create helper function for consistent payment creation
4. **MEDIUM**: Handle credits/refunds properly
5. **LOW**: Fix currency hardcoding

