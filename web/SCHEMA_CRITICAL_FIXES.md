# Critical Schema Fixes - Quick Reference

## 🚨 Must Fix Immediately

### 1. Link Users to Customers
**Problem:** Users can't access their subscription/license data.

**Fix:**
```typescript
// Option A: One user per customer (simpler)
export const customers = pgTable("customers", {
  // ... existing fields
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "set null" })
    .unique(),
});

// Option B: Multiple users per customer (team accounts)
export const customerUsers = pgTable("customer_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .references(() => customers.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  role: varchar("role", { length: 50 }).default("user"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

### 2. Link Payments to Subscriptions
**Problem:** Can't track which payment belongs to which subscription.

**Fix:**
```typescript
export const payments = pgTable("payments", {
  // ... existing fields
  subscriptionId: uuid("subscription_id")
    .references(() => subscriptions.id, { onDelete: "set null" }),
  paymentType: varchar("payment_type", { length: 20 }), // 'subscription', 'one-time'
});
```

### 3. Add Missing Subscription Fields
**Problem:** Can't track cancellations, trials, or plan details.

**Fix:**
```typescript
export const subscriptions = pgTable("subscriptions", {
  // ... existing fields
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  trialStart: timestamp("trial_start", { withTimezone: true }),
  trialEnd: timestamp("trial_end", { withTimezone: true }),
  planId: varchar("plan_id", { length: 100 }), // Reference to plan
  nextBillingDate: timestamp("next_billing_date", { withTimezone: true }),
});
```

### 4. Add License Key Lifecycle
**Problem:** Can't expire or revoke licenses.

**Fix:**
```typescript
export const licenseKeys = pgTable("license_keys", {
  // ... existing fields
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revocationReason: text("revocation_reason"),
});
```

---

## 📋 Migration Priority

1. **Week 1:** User-Customer relationship + Payment-Subscription link
2. **Week 2:** Subscription enhancements + License key lifecycle
3. **Week 3:** Plan catalog + Payment methods
4. **Week 4:** Invoices + Audit logs

---

## 🔍 Quick Validation Queries

After fixes, test with:

```sql
-- Check user-customer links
SELECT u.email, c.company_name 
FROM users u 
LEFT JOIN customers c ON c.user_id = u.id;

-- Check payment-subscription links
SELECT p.amount, s.plan_type, s.status
FROM payments p
LEFT JOIN subscriptions s ON s.id = p.subscription_id;

-- Check active subscriptions
SELECT c.email, s.plan_type, s.current_period_end
FROM subscriptions s
JOIN customers c ON c.id = s.customer_id
WHERE s.status = 'active';
```

