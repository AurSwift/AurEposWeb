# Customer and Subscription Lifecycle

This document explains the important distinction between **canceling a subscription** and **deleting a customer**.

## Key Principle

**Canceling a subscription ≠ Deleting a customer**

## Subscription Cancellation

When a user cancels their subscription via the "Cancel Subscription" button:

### What Happens:

1. ✅ Subscription is canceled in Stripe (either immediately or at period end)
2. ✅ Subscription status updated to "canceled" in database
3. ✅ License keys are revoked (if immediate cancellation)
4. ✅ Desktop apps are notified via SSE events
5. ✅ Grace period starts (7 days to export data)

### What Does NOT Happen:

- ❌ Customer account is NOT deleted
- ❌ Customer status remains "active"
- ❌ User can still access billing portal
- ❌ User can still view payment history
- ❌ User can reactivate subscription
- ❌ User can export their data

### Code Location:

- **Endpoint**: `/app/api/subscriptions/cancel/route.ts`
- **Handler**: `POST` function

### Database Changes:

```sql
-- Subscription table
UPDATE subscriptions
SET
  cancel_at_period_end = true/false,
  canceled_at = NOW() (if immediate),
  status = 'canceled' (if immediate)
WHERE id = <subscription_id>;

-- Customer table
-- NO CHANGES - customer status stays "active"
```

## Customer Deletion

Customer deletion **ONLY** happens in two scenarios:

### 1. Admin Deletes Customer in Stripe Dashboard

- An administrator explicitly deletes the customer in the Stripe dashboard
- Stripe sends a `customer.deleted` webhook event
- Our system processes this webhook

### 2. Stripe Automatically Deletes Customer

- Rare: Stripe deletes dormant customers after extended periods
- Stripe sends a `customer.deleted` webhook event

### What Happens on Customer Deletion:

1. ✅ All active subscriptions are canceled in Stripe
2. ✅ All active subscriptions marked as "canceled" in database
3. ✅ All license keys are revoked
4. ✅ Customer status set to "deleted" in database
5. ✅ Stripe customer ID is unlinked (`stripeCustomerId = null`)
6. ✅ All desktop apps receive `license_revoked` SSE events
7. ✅ Immediate deactivation (no grace period)

### Code Location:

- **Webhook Handler**: `/app/api/stripe/webhooks/handler/route.ts`
- **Function**: `handleCustomerDeleted()` in `/lib/stripe/webhook-handlers.ts`

### Database Changes:

```sql
-- Customer table
UPDATE customers
SET
  status = 'deleted',
  stripe_customer_id = NULL,
  updated_at = NOW()
WHERE stripe_customer_id = <stripe_customer_id>;

-- Subscriptions table
UPDATE subscriptions
SET
  status = 'cancelled',
  canceled_at = NOW(),
  updated_at = NOW()
WHERE customer_id = <customer_id>;

-- License keys table
UPDATE license_keys
SET
  is_active = false,
  revoked_at = NOW(),
  revocation_reason = 'Customer deleted in Stripe'
WHERE customer_id = <customer_id>;
```

## Customer Status States

### "active" (Normal)

- Customer has an active account
- Can have active, trialing, or canceled subscriptions
- Can access billing portal
- Can reactivate canceled subscriptions
- Can export data

### "deleted" (Rare)

- Customer was deleted in Stripe
- Cannot access billing portal
- Cannot reactivate subscriptions
- All licenses permanently revoked
- Shows error: "Your customer account has been deleted"

### "suspended" (Future)

- Placeholder for future admin suspension feature
- Not currently used

## Common Scenarios

### Scenario 1: User cancels trial

- ✅ Subscription canceled
- ✅ License revoked after grace period
- ✅ Customer status: **"active"**
- ✅ User can still log in
- ✅ User can view billing
- ✅ User can start a new subscription

### Scenario 2: User cancels paid subscription

- ✅ Subscription canceled at period end (default)
- ✅ Access continues until period end
- ✅ License revoked after grace period
- ✅ Customer status: **"active"**
- ✅ User can reactivate before period end

### Scenario 3: Admin deletes customer in Stripe

- ✅ Stripe sends `customer.deleted` webhook
- ✅ All subscriptions canceled
- ✅ All licenses revoked immediately
- ✅ Customer status: **"deleted"**
- ❌ User cannot access billing portal
- ❌ User cannot reactivate
- ❌ Shows "account deleted" error

## Debugging Customer Issues

### If user sees "Customer account deleted" error:

1. Check customer status in database:

```typescript
// Run: npx tsx scripts/list-users.ts
// Look for status: "deleted"
```

2. Check if this was intentional:

- Was customer deleted in Stripe dashboard?
- Check Stripe logs for `customer.deleted` event

3. If accidental, restore customer:

```typescript
// Run: npx tsx scripts/reactivate-customer.ts
```

4. Prevent future issues:

- Train admins not to delete customers in Stripe
- Use subscription cancellation instead
- Only delete customers for legal/compliance reasons

## Best Practices

### For Cancellations:

1. ✅ Always use "Cancel Subscription" button
2. ✅ Explain grace period to users
3. ✅ Allow data export before revocation
4. ✅ Send confirmation emails

### For Customer Deletion:

1. ⚠️ Rarely needed - avoid if possible
2. ⚠️ Only for legal/compliance (GDPR, etc.)
3. ⚠️ Warn user before deleting
4. ⚠️ Export user data first
5. ⚠️ Delete in Stripe dashboard (not manually in DB)

## Related Files

- `/app/api/subscriptions/cancel/route.ts` - Subscription cancellation
- `/lib/stripe/webhook-handlers.ts` - `handleCustomerDeleted()`
- `/app/api/stripe/webhooks/handler/route.ts` - Webhook routing
- `/lib/db/customer-helpers.ts` - `getCustomerOrThrow()` (checks status)
- `/app/api/stripe/billing/portal/route.ts` - Billing portal (blocks deleted)

## Testing

### Test subscription cancellation:

1. Create test subscription
2. Cancel via dashboard
3. Verify customer status = "active"
4. Verify subscription status = "canceled"
5. Verify user can still access billing portal

### Test customer deletion:

1. Create test customer in Stripe
2. Delete in Stripe dashboard
3. Verify webhook received
4. Verify customer status = "deleted"
5. Verify all licenses revoked
6. Verify billing portal shows error
