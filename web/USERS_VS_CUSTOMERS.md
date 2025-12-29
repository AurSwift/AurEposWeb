# Users vs Customers - Design Explanation

## Current Situation

You have **two separate tables** that seem to overlap:

### `users` Table (Authentication)

- Purpose: NextAuth.js authentication
- Fields: `email`, `password`, `name`, `image`, `emailVerified`
- Used for: Login, session management, OAuth

### `customers` Table (Business)

- Purpose: EPOS customer/business records
- Fields: `companyName`, `email`, `billingAddress`, `taxId`, `status`
- Used for: Subscriptions, licenses, payments, billing

## Why Two Tables? (Current Design Intent)

The separation suggests a **B2B SaaS model** where:

1. **Users** = Individual people who log into the website
2. **Customers** = Businesses/companies that purchase EPOS software

**The idea:** One business (customer) can have multiple users (employees).

### Example Scenario:

```
Customer: "ABC Restaurant" (company)
  ├── User 1: owner@abcrestaurant.com (owner)
  ├── User 2: manager@abcrestaurant.com (manager)
  └── User 3: cashier@abcrestaurant.com (staff)

Subscription: 1 subscription for ABC Restaurant
License Keys: Shared across all users
Payments: Billed to ABC Restaurant
```

## The Problem

**They're completely disconnected!** ❌

- No relationship between `users` and `customers`
- Users can't access their company's subscription
- Can't determine which user belongs to which customer
- Authentication system isolated from business data

## Solutions

### Option 1: Merge Into One Table (Simpler - Recommended for B2C)

**Best for:** Individual customers buying for themselves

```typescript
// Single table approach
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Auth fields
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password"),
  name: varchar("name", { length: 255 }),
  // Business fields
  companyName: varchar("company_name", { length: 255 }),
  billingAddress: jsonb("billing_address"),
  taxId: varchar("tax_id", { length: 50 }),
  status: varchar("status", { length: 20 }),
  // ... rest
});
```

**Pros:**

- ✅ Simpler - one table
- ✅ Direct relationship
- ✅ Less joins needed
- ✅ Easier to query

**Cons:**

- ❌ Can't have multiple users per customer
- ❌ Mixing auth and business concerns

---

### Option 2: Link Users to Customers (Current Structure - Better for B2B)

**Best for:** Businesses with multiple employees

```typescript
// Keep both tables, but link them
export const customers = pgTable("customers", {
  // ... existing fields
  // Add primary user (owner)
  primaryUserId: uuid("primary_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
});

// Junction table for team members
export const customerUsers = pgTable("customer_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .references(() => customers.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  role: varchar("role", { length: 50 }), // 'owner', 'admin', 'user'
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

**Pros:**

- ✅ Supports team accounts
- ✅ Multiple users per customer
- ✅ Role-based access
- ✅ Separates concerns (auth vs business)

**Cons:**

- ❌ More complex queries
- ❌ More tables to manage

---

### Option 3: One-to-One Relationship (Simplest Link)

**Best for:** One user = One customer (most common)

```typescript
export const customers = pgTable("customers", {
  // ... existing fields
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique() // One customer per user
    .notNull(),
});
```

**Pros:**

- ✅ Simple relationship
- ✅ Easy to query
- ✅ Keeps separation of concerns

**Cons:**

- ❌ Can't have team accounts
- ❌ One user = one customer only

---

## Recommendation for Your EPOS Platform

### For B2C (Individual Restaurants/Stores):

**Use Option 1 or 3** - Merge or one-to-one link

Most EPOS customers are small businesses with 1-2 users. Simpler is better.

### For B2B (Enterprise with Multiple Locations):

**Use Option 2** - Team accounts with junction table

If you have:

- Chain restaurants with multiple locations
- Corporate accounts with multiple managers
- Franchise models

Then you need team support.

---

## Current State Analysis

Looking at your schema:

- `customers` has `companyName` → Suggests B2B
- `customers` has `billingAddress`, `taxId` → Business billing
- `users` has `email`, `password` → Individual authentication

**Verdict:** You designed for B2B but forgot to link them! 🔗

---

## Quick Fix (Recommended)

For most EPOS platforms, **Option 3** (one-to-one) is best:

```typescript
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique()
    .notNull(), // ADD THIS
  companyName: varchar("company_name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  // ... rest
});
```

**Why:**

- Most EPOS customers are single-owner businesses
- Simple to implement
- Easy to query: `SELECT * FROM customers WHERE user_id = ?`
- Can upgrade to Option 2 later if needed

---

## Migration Path

1. **Add `userId` to `customers` table**
2. **Link existing data:**
   ```sql
   -- Match by email
   UPDATE customers c
   SET user_id = u.id
   FROM users u
   WHERE c.email = u.email;
   ```
3. **Update application code** to use the relationship
4. **Add foreign key constraint**

---

## Summary

**Why two tables?**

- Separation of concerns (auth vs business)
- Support for team accounts (multiple users per customer)

**The problem:**

- They're not linked! Users can't access their customer data.

**The solution:**

- Add `userId` to `customers` (one-to-one) OR
- Create `customerUsers` junction table (many-to-many)

**For EPOS:** Start with one-to-one, upgrade to many-to-many if needed.
