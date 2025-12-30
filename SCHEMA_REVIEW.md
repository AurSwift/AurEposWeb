# Database Schema Code Review - EPOS Website

## Executive Summary

**Overall Assessment:** ⚠️ **Good foundation, but needs improvements for production EPOS platform**

The schema has a solid structure but lacks critical fields, constraints, and relationships needed for a robust EPOS subscription platform. Several business logic gaps and data integrity issues need addressing.

---

## 🔴 Critical Issues

### 1. **Missing User-Customer Relationship**

**Issue:** `users` and `customers` tables are completely disconnected.

**Problem:**

- No way to link authenticated users to customer accounts
- Users can't access their subscription/license data
- Authentication system isolated from business data

**Impact:** High - Core functionality broken

**Recommendation:**

```typescript
// Add to customers table
userId: uuid("user_id")
  .references(() => users.id, { onDelete: "set null" })
  .unique(), // One customer per user

// Or if multiple users per customer (team accounts)
// Create junction table:
export const customerUsers = pgTable("customer_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .references(() => customers.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  role: varchar("role", { length: 50 }), // 'owner', 'admin', 'user'
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

---

### 2. **Missing Subscription-Payment Link**

**Issue:** `payments` table has no reference to `subscriptions`.

**Problem:**

- Can't track which payment belongs to which subscription
- Difficult to reconcile billing periods
- No way to link recurring payments to subscriptions

**Impact:** High - Billing reconciliation impossible

**Recommendation:**

```typescript
// Add to payments table
subscriptionId: uuid("subscription_id")
  .references(() => subscriptions.id, { onDelete: "set null" }),
paymentType: varchar("payment_type", { length: 20 }), // 'subscription', 'one-time', 'refund'
billingPeriodStart: timestamp("billing_period_start", { withTimezone: true }),
billingPeriodEnd: timestamp("billing_period_end", { withTimezone: true }),
```

---

### 3. **Missing Critical Subscription Fields**

**Issue:** Subscriptions lack essential billing and plan management fields.

**Missing Fields:**

- `canceledAt` - When subscription was canceled
- `cancelAtPeriodEnd` - Cancel at end of billing period
- `trialStart` / `trialEnd` - Trial period tracking
- `planId` / `planName` - Reference to plan catalog
- `quantity` - For multi-seat subscriptions
- `metadata` - JSONB for custom plan features

**Recommendation:**

```typescript
export const subscriptions = pgTable("subscriptions", {
  // ... existing fields
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  trialStart: timestamp("trial_start", { withTimezone: true }),
  trialEnd: timestamp("trial_end", { withTimezone: true }),
  planId: varchar("plan_id", { length: 100 }), // Reference to plan catalog
  quantity: integer("quantity").default(1), // Multi-seat support
  metadata: jsonb("metadata"), // Custom plan features, limits, etc.
  nextBillingDate: timestamp("next_billing_date", { withTimezone: true }),
});
```

---

### 4. **License Key Generation & Validation**

**Issue:** No fields for license key lifecycle management.

**Missing:**

- `expiresAt` - License expiration date
- `issuedAt` - When license was issued
- `revokedAt` - When license was revoked
- `revocationReason` - Why license was revoked
- `version` - License key format version

**Recommendation:**

```typescript
export const licenseKeys = pgTable("license_keys", {
  // ... existing fields
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  issuedAt: timestamp("issued_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revocationReason: text("revocation_reason"),
  version: varchar("version", { length: 10 }).default("1.0"),
  notes: text("notes"), // Admin notes
});
```

---

## 🟡 Important Issues

### 5. **Missing Payment Method Storage**

**Issue:** No way to store customer payment methods.

**Problem:**

- Can't store credit card details (tokenized)
- No payment method management
- Difficult to set up recurring billing

**Recommendation:**

```typescript
export const paymentMethods = pgTable("payment_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .references(() => customers.id, { onDelete: "cascade" })
    .notNull(),
  type: varchar("type", { length: 20 }), // 'card', 'bank_account', 'paypal'
  provider: varchar("provider", { length: 50 }), // 'stripe', 'paypal'
  providerPaymentMethodId: varchar("provider_payment_method_id", {
    length: 255,
  }),
  lastFour: varchar("last_four", { length: 4 }),
  brand: varchar("brand", { length: 50 }), // 'visa', 'mastercard'
  expiryMonth: integer("expiry_month"),
  expiryYear: integer("expiry_year"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

---

### 6. **Missing Invoice/Receipt Management**

**Issue:** Only `invoiceUrl` in payments, no proper invoice table.

**Problem:**

- Can't generate invoices
- No invoice history
- No receipt management
- No tax calculation tracking

**Recommendation:**

```typescript
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .references(() => customers.id)
    .notNull(),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
  status: varchar("status", { length: 20 }), // 'draft', 'open', 'paid', 'void'
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  invoiceUrl: text("invoice_url"),
  pdfUrl: text("pdf_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

---

### 7. **Missing Plan Catalog/Product Table**

**Issue:** Plan types are hardcoded strings.

**Problem:**

- Can't manage plans dynamically
- No plan features/limits storage
- Difficult to add new plans
- No pricing tiers management

**Recommendation:**

```typescript
export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: varchar("plan_id", { length: 100 }).notNull().unique(), // 'basic', 'pro', 'enterprise'
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  priceMonthly: decimal("price_monthly", { precision: 10, scale: 2 }),
  priceAnnual: decimal("price_annual", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  maxTerminals: integer("max_terminals").default(1),
  features: jsonb("features"), // Array of feature names
  limits: jsonb("limits"), // { storage: "10GB", users: 5, etc. }
  isActive: boolean("is_active").default(true),
  isPublic: boolean("is_public").default(true), // Show on pricing page
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

---

### 8. **Missing Audit Trail**

**Issue:** No tracking of changes to critical data.

**Problem:**

- Can't track who changed what
- No compliance audit trail
- Difficult to debug issues
- No change history

**Recommendation:**

```typescript
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  entityType: varchar("entity_type", { length: 50 }), // 'subscription', 'license', 'payment'
  entityId: uuid("entity_id").notNull(),
  action: varchar("action", { length: 50 }), // 'create', 'update', 'delete'
  changes: jsonb("changes"), // Before/after values
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

---

### 9. **Missing Constraints & Validations**

**Issues:**

- No CHECK constraints for enum-like fields
- No NOT NULL constraints on critical fields
- No unique constraints where needed

**Recommendations:**

```typescript
// Add indexes for performance
export const subscriptions = pgTable("subscriptions", {
  // ... fields
}, (table) => ({
  customerIdIdx: index("subscriptions_customer_id_idx").on(table.customerId),
  statusIdx: index("subscriptions_status_idx").on(table.status),
  currentPeriodEndIdx: index("subscriptions_period_end_idx").on(table.currentPeriodEnd),
}));

// Add CHECK constraints
status: varchar("status", { length: 20 })
  .notNull()
  .$default(() => "active"), // With check constraint in migration
```

---

### 10. **Activation Table Improvements**

**Issues:**

- No `userId` to track who activated
- No `deactivatedAt` timestamp
- No `deactivationReason`
- Missing `softwareVersion` field

**Recommendation:**

```typescript
export const activations = pgTable("activations", {
  // ... existing fields
  userId: uuid("user_id").references(() => users.id), // Who activated
  softwareVersion: varchar("software_version", { length: 50 }),
  osType: varchar("os_type", { length: 50 }), // 'windows', 'macos', 'linux'
  osVersion: varchar("os_version", { length: 100 }),
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  deactivationReason: varchar("deactivation_reason", { length: 255 }),
  notes: text("notes"),
});
```

---

## 🟢 Good Practices (Keep These)

✅ **UUID primary keys** - Good for distributed systems  
✅ **Timestamps with timezone** - Proper timezone handling  
✅ **JSONB for flexible data** - Good for billing_address, location  
✅ **Cascade deletes** - Proper referential integrity  
✅ **Relations defined** - Good Drizzle ORM practices  
✅ **Unique constraints** - email, license_key properly constrained

---

## 📊 Missing Tables for Complete EPOS Platform

### 11. **Support Tickets**

```typescript
export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id),
  userId: uuid("user_id").references(() => users.id),
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description").notNull(),
  status: varchar("status", { length: 20 }), // 'open', 'in_progress', 'resolved', 'closed'
  priority: varchar("priority", { length: 20 }), // 'low', 'medium', 'high', 'urgent'
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

### 12. **Usage Analytics**

```typescript
export const usageMetrics = pgTable("usage_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenseKeyId: uuid("license_key_id").references(() => licenseKeys.id),
  activationId: uuid("activation_id").references(() => activations.id),
  metricType: varchar("metric_type", { length: 50 }), // 'api_call', 'transaction', 'storage'
  value: decimal("value", { precision: 15, scale: 2 }),
  metadata: jsonb("metadata"),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

### 13. **Discounts/Coupons**

```typescript
export const coupons = pgTable("coupons", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  discountType: varchar("discount_type", { length: 20 }), // 'percentage', 'fixed'
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }),
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").default(0),
  isActive: boolean("is_active").default(true),
});
```

---

## 🔧 Recommended Schema Improvements Summary

### High Priority (Must Fix)

1. ✅ Add `userId` to `customers` table or create `customerUsers` junction
2. ✅ Add `subscriptionId` to `payments` table
3. ✅ Add missing subscription fields (canceledAt, trial dates, etc.)
4. ✅ Add license key expiration/revocation fields

### Medium Priority (Should Fix)

5. ✅ Create `paymentMethods` table
6. ✅ Create `invoices` table
7. ✅ Create `plans` catalog table
8. ✅ Add indexes for performance

### Low Priority (Nice to Have)

9. ✅ Create `auditLogs` table
10. ✅ Create `supportTickets` table
11. ✅ Create `usageMetrics` table
12. ✅ Create `coupons` table

---

## 🎯 Action Items

1. **Immediate:** Fix user-customer relationship
2. **This Week:** Add subscription-payment link and missing subscription fields
3. **This Month:** Implement plan catalog and payment methods
4. **Future:** Add audit logs, support tickets, analytics

---

## 📝 Notes

- Consider using ENUM types instead of VARCHAR for status fields (better type safety)
- Add database-level constraints in migrations (not just in TypeScript)
- Consider soft deletes for important entities (add `deletedAt` timestamp)
- Add `updatedAt` triggers for all tables (currently only some have it)
- Consider partitioning large tables (payments, activations) by date

---

## 🔗 Related Documentation

- [Drizzle ORM Best Practices](https://orm.drizzle.team/docs/overview)
- [PostgreSQL Indexing Guide](https://www.postgresql.org/docs/current/indexes.html)
- [Stripe Subscription Model](https://stripe.com/docs/billing/subscriptions/overview)
