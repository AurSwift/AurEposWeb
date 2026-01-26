# Database Tables: Users, Accounts, Customers, and Employees

This document explains the four core tables in the Aurswift EPOS platform database: `users`, `accounts`, `customers`, and `employees`. It covers their structure, relationships, and how they work together to support both customer-facing and internal operations.

## Table Overview

The application uses a **role-based access control (RBAC)** system where a single `users` table handles authentication, and specialized tables (`customers`, `employees`) extend user functionality based on their role.

```
┌─────────┐
│  users  │  (Core authentication)
└────┬────┘
     │
     ├─────────────────┬──────────────────┐
     │                 │                  │
┌────▼────┐      ┌────▼────┐      ┌─────▼─────┐
│accounts │      │customers│      │ employees │
│(OAuth)  │      │(B2B)    │      │(Internal) │
└─────────┘      └─────────┘      └───────────┘
```

---

## 1. Users Table

### Purpose

Core authentication table for NextAuth.js. All users in the system (customers, employees, admins) must have a record in this table.

### Schema

```typescript
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: timestamp("email_verified", {
    withTimezone: true,
    mode: "date",
  }),
  name: varchar("name", { length: 255 }),
  image: varchar("image", { length: 500 }),
  password: text("password"), // Hashed password (optional for OAuth users)
  role: varchar("role", { length: 20 }).default("customer").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

### Key Fields

- **`id`** (UUID, Primary Key): Unique identifier for the user
- **`email`** (VARCHAR, Unique, Required): User's email address (used for login)
- **`password`** (TEXT, Optional): Hashed password for email/password authentication (null for OAuth-only users)
- **`role`** (VARCHAR, Default: "customer", Required): Determines user type:
  - `"customer"` - Regular customers who purchase EPOS licenses
  - `"admin"` - Platform administrators
  - `"support"` - Customer support staff
  - `"developer"` - Internal developers
- **`emailVerified`** (TIMESTAMP, Optional): When the email was verified
- **`name`** (VARCHAR, Optional): Display name
- **`image`** (VARCHAR, Optional): Profile image URL

### Relationships

- **One-to-Many** with `accounts` (OAuth providers)
- **One-to-Many** with `sessions` (NextAuth sessions)
- **One-to-One** with `customers` (if `role = "customer"`)
- **One-to-One** with `employees` (if `role = "admin" | "support" | "developer"`)

### Usage Notes

- All authentication flows (email/password, OAuth) create records here first
- The `role` field determines which additional table the user is linked to
- Internal users (admin/support/developer) **do not** have customer records
- Customer users **do not** have employee records

---

## 2. Accounts Table

### Purpose

Stores OAuth provider connections for NextAuth.js. Allows users to sign in via Google, GitHub, etc., in addition to email/password.

### Schema

```typescript
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 255 }).notNull(),
  providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
  refreshToken: text("refresh_token"),
  accessToken: text("access_token"),
  expiresAt: integer("expires_at"),
  tokenType: varchar("token_type", { length: 255 }),
  scope: varchar("scope", { length: 255 }),
  idToken: text("id_token"),
  sessionState: varchar("session_state", { length: 255 }),
});
```

### Key Fields

- **`id`** (UUID, Primary Key): Unique identifier for the account record
- **`userId`** (UUID, Foreign Key → `users.id`, Required): Links to the user who owns this OAuth account
- **`provider`** (VARCHAR, Required): OAuth provider name (e.g., "google", "github", "credentials")
- **`providerAccountId`** (VARCHAR, Required): User's ID in the OAuth provider's system
- **`accessToken`**, **`refreshToken`** (TEXT, Optional): OAuth tokens (encrypted at rest)
- **`expiresAt`** (INTEGER, Optional): Token expiration timestamp

### Relationships

- **Many-to-One** with `users` (a user can have multiple OAuth accounts)

### Usage Notes

- A user can link multiple OAuth providers to their account
- Email/password authentication is also stored here with `provider = "credentials"`
- Records cascade delete when the user is deleted
- Tokens are stored encrypted and should never be logged

---

## 3. Customers Table

### Purpose

Stores business information for EPOS platform customers. Contains billing details, subscription data, and Stripe integration fields. Only users with `role = "customer"` have records here.

### Schema

```typescript
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  companyName: varchar("company_name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  billingAddress: jsonb("billing_address"),
  taxId: varchar("tax_id", { length: 50 }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  status: varchar("status", { length: 20 }).default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

### Key Fields

- **`id`** (UUID, Primary Key): Unique identifier for the customer record
- **`userId`** (UUID, Foreign Key → `users.id`, Unique, Required): Links to exactly one user (one-to-one relationship)
- **`companyName`** (VARCHAR, Optional): Business name (e.g., "ABC Restaurant")
- **`email`** (VARCHAR, Unique, Required): Customer's business email (may differ from user email)
- **`billingAddress`** (JSONB, Optional): Structured billing address (street, city, state, postal code, country)
- **`taxId`** (VARCHAR, Optional): Tax identification number (VAT, GST, etc.)
- **`stripeCustomerId`** (VARCHAR, Optional): Stripe customer ID for payment processing
- **`status`** (VARCHAR, Default: "active"): Customer account status:
  - `"active"` - Normal, active customer
  - `"suspended"` - Temporarily suspended
  - `"cancelled"` - Subscription cancelled
  - `"deleted"` - Soft-deleted (for data retention)

### Relationships

- **One-to-One** with `users` (via `userId`, unique constraint)
- **One-to-Many** with `subscriptions` (a customer can have multiple subscriptions over time)
- **One-to-Many** with `licenseKeys` (EPOS license keys issued to this customer)
- **One-to-Many** with `payments` (payment history)
- **One-to-Many** with `supportTickets` (support requests)
- **One-to-Many** with `paymentMethods` (saved payment methods)

### Usage Notes

- **Only created for users with `role = "customer"`**
- The `userId` field has a **unique constraint**, meaning each user can be linked to only one customer record
- Records are created when a customer signs up and makes their first purchase
- `stripeCustomerId` is set when the customer first adds a payment method or subscribes
- The `status` field supports soft deletion (set to "deleted" instead of hard delete)

### Helper Functions

The application provides helper functions in `lib/db/customer-helpers.ts`:

```typescript
// Get customer by user ID (returns null if not found)
const customer = await getCustomerByUserId(session.user.id);

// Get customer or throw error (for APIs where customer must exist)
const customer = await getCustomerOrThrow(session.user.id);

// Check if user is a customer (for role-based access)
const customer = await getCustomerFromSession(session);
```

### Example Query

```typescript
// Get customer with all subscriptions
const customer = await db.query.customers.findFirst({
  where: eq(customers.userId, userId),
  with: {
    subscriptions: true,
    licenseKeys: true,
  },
});
```

---

## 4. Employees Table

### Purpose

Stores additional information for internal staff members (admins, support, developers). Only users with `role = "admin" | "support" | "developer"` have records here.

### Schema

```typescript
export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  department: varchar("department", { length: 50 }),
  jobTitle: varchar("job_title", { length: 100 }),
  isActive: boolean("is_active").default(true).notNull(),
  hiredAt: timestamp("hired_at", { withTimezone: true }),
  terminatedAt: timestamp("terminated_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

### Key Fields

- **`id`** (UUID, Primary Key): Unique identifier for the employee record
- **`userId`** (UUID, Foreign Key → `users.id`, Unique, Required): Links to exactly one user (one-to-one relationship)
- **`department`** (VARCHAR, Optional): Department name (e.g., "support", "sales", "engineering", "management")
- **`jobTitle`** (VARCHAR, Optional): Job title (e.g., "Senior Support Engineer", "Product Manager")
- **`isActive`** (BOOLEAN, Default: true, Required): Whether the employee is currently active
- **`hiredAt`** (TIMESTAMP, Optional): Employment start date
- **`terminatedAt`** (TIMESTAMP, Optional): Employment end date (null if still active)
- **`notes`** (TEXT, Optional): Internal admin notes about the employee

### Relationships

- **One-to-One** with `users` (via `userId`, unique constraint)

### Usage Notes

- **Only created for users with `role = "admin" | "support" | "developer"`**
- The `userId` field has a **unique constraint**, meaning each user can be linked to only one employee record
- Used for internal HR and permission management
- `isActive = false` and `terminatedAt` set when employee leaves (soft termination)
- Records are optional—internal users can exist in `users` table without an `employees` record if minimal info is needed

### Example Query

```typescript
// Get all active employees in support department
const supportStaff = await db.query.employees.findMany({
  where: and(eq(employees.department, "support"), eq(employees.isActive, true)),
  with: {
    user: true, // Include user email, name, etc.
  },
});
```

---

## Relationship Summary

### One-to-One Relationships (Mutually Exclusive)

A user can be **either** a customer **or** an employee, but **not both**:

- `users.id` ↔ `customers.userId` (unique) - Only for `role = "customer"`
- `users.id` ↔ `employees.userId` (unique) - Only for `role = "admin" | "support" | "developer"`

### One-to-Many Relationships

- `users.id` → `accounts.userId` (a user can have multiple OAuth accounts)
- `users.id` → `sessions.userId` (a user can have multiple active sessions)
- `customers.id` → `subscriptions.customerId` (a customer can have multiple subscriptions)
- `customers.id` → `licenseKeys.customerId` (a customer can have multiple license keys)
- `customers.id` → `payments.customerId` (payment history)
- `customers.id` → `supportTickets.customerId` (support tickets)

### Database Constraints

- **Foreign Keys**: All relationships use foreign key constraints with cascade delete
- **Unique Constraints**:
  - `customers.userId` is unique (one customer per user)
  - `employees.userId` is unique (one employee record per user)
  - `users.email` is unique
  - `customers.email` is unique
- **Indexes**: All foreign keys and frequently queried fields are indexed for performance

---

## Common Patterns and Usage

### 1. Creating a New Customer User

```typescript
// 1. Create user record
const user = await db
  .insert(users)
  .values({
    email: "owner@restaurant.com",
    password: hashedPassword,
    name: "John Doe",
    role: "customer", // Important: must be "customer"
  })
  .returning();

// 2. Create customer record
const customer = await db
  .insert(customers)
  .values({
    userId: user[0].id,
    companyName: "ABC Restaurant",
    email: "owner@restaurant.com",
    status: "active",
  })
  .returning();
```

### 2. Creating a New Employee User

```typescript
// 1. Create user record
const user = await db
  .insert(users)
  .values({
    email: "support@Aurswift.com",
    password: hashedPassword,
    name: "Jane Smith",
    role: "support", // Can be "admin", "support", or "developer"
  })
  .returning();

// 2. Create employee record (optional)
const employee = await db
  .insert(employees)
  .values({
    userId: user[0].id,
    department: "support",
    jobTitle: "Customer Support Specialist",
    isActive: true,
    hiredAt: new Date(),
  })
  .returning();
```

### 3. Getting Customer Data from Session

```typescript
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";

export async function GET(request: Request) {
  const session = await getServerSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // This throws if customer doesn't exist
  const customer = await getCustomerOrThrow(session.user.id);

  // Use customer data
  return NextResponse.json({ customer });
}
```

### 4. Checking User Role for Access Control

```typescript
const session = await getServerSession();

if (!session?.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// Internal users (admin, support, developer) don't have customer records
if (
  session.user.role === "admin" ||
  session.user.role === "support" ||
  session.user.role === "developer"
) {
  // Handle internal user access
  const employee = await db.query.employees.findFirst({
    where: eq(employees.userId, session.user.id),
  });
} else {
  // Handle customer access
  const customer = await getCustomerOrThrow(session.user.id);
}
```

### 5. Linking OAuth Account to Existing User

```typescript
// When user signs in with OAuth for the first time
const account = await db
  .insert(accounts)
  .values({
    userId: user.id,
    type: "oauth",
    provider: "google",
    providerAccountId: googleUser.id,
    accessToken: encryptedToken,
    refreshToken: encryptedRefreshToken,
    expiresAt: tokenExpiry,
  })
  .returning();
```

---

## Design Decisions

### Why Separate Tables?

1. **Separation of Concerns**: Authentication (`users`) is separate from business logic (`customers`, `employees`)
2. **Role-Based Access**: Different roles require different data (billing info for customers, HR info for employees)
3. **Scalability**: Can add more specialized tables without affecting authentication
4. **Data Integrity**: Foreign key constraints ensure data consistency

### Why One-to-One Instead of Many-to-Many?

The current design uses **one-to-one** relationships (`customers.userId` and `employees.userId` are unique). This means:

- ✅ **One user = One customer** (simplest for most EPOS customers)
- ✅ **One user = One employee record** (internal staff are individuals)

**Future Enhancement**: If team accounts are needed (multiple users per customer), you could:

1. Add a `customerUsers` junction table for many-to-many
2. Keep `customers.userId` as the "primary owner"
3. Allow additional users to be linked via the junction table

---

## Migration Notes

If you need to link existing data:

```sql
-- Link existing customers to users by matching email
UPDATE customers c
SET user_id = u.id
FROM users u
WHERE c.email = u.email
AND u.role = 'customer'
AND c.user_id IS NULL;

-- Link existing employees to users by matching email
UPDATE employees e
SET user_id = u.id
FROM users u
WHERE u.email = e.email  -- If employees table has email
AND u.role IN ('admin', 'support', 'developer')
AND e.user_id IS NULL;
```

---

## Summary

| Table         | Purpose             | Relationship to Users | When Created                                             |
| ------------- | ------------------- | --------------------- | -------------------------------------------------------- |
| **users**     | Core authentication | N/A (base table)      | On signup/login                                          |
| **accounts**  | OAuth providers     | Many-to-One           | When linking OAuth account                               |
| **customers** | Business customers  | One-to-One (unique)   | When `role = "customer"` signs up                        |
| **employees** | Internal staff      | One-to-One (unique)   | When `role = "admin"\|"support"\|"developer"` is created |

**Key Takeaway**: A user can be **either** a customer **or** an employee (or neither, if just authenticated), but never both. The `users.role` field determines which path they follow.
