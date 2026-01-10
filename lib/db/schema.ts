import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  boolean,
  integer,
  decimal,
  inet,
  text,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// AUTHENTICATION & USER MANAGEMENT
// ============================================================================

// Users table for NextAuth authentication
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
  role: varchar("role", { length: 20 }).default("customer").notNull(), // 'customer', 'admin', 'support', 'developer'
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Accounts table for OAuth providers (NextAuth required)
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

// Sessions table for NextAuth session management
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionToken: varchar("session_token", { length: 255 }).notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
});

// Verification tokens table for NextAuth (email verification, magic links, etc.)
export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull(),
  token: text("token").notNull().unique(),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================================================
// RBAC (Role-Based Access Control) & PERMISSIONS
// ============================================================================

// Employees table (internal users) - OPTIONAL for startups
export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .unique()
      .notNull(),
    department: varchar("department", { length: 50 }), // 'support', 'sales', 'engineering', 'management'
    jobTitle: varchar("job_title", { length: 100 }),
    isActive: boolean("is_active").default(true).notNull(),
    hiredAt: timestamp("hired_at", { withTimezone: true }),
    terminatedAt: timestamp("terminated_at", { withTimezone: true }),
    notes: text("notes"), // Admin notes about employee
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index("employees_user_id_idx").on(table.userId),
    departmentIdx: index("employees_department_idx").on(table.department),
    isActiveIdx: index("employees_is_active_idx").on(table.isActive),
  })
);

// Permissions table (for granular access control)
export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull().unique(), // e.g., "customers.read_all", "licenses.revoke"
    description: text("description").notNull(),
    resource: varchar("resource", { length: 50 }).notNull(), // "customers", "subscriptions", "licenses", "support", "billing", "admin"
    action: varchar("action", { length: 50 }).notNull(), // "read", "write", "delete", "revoke", "create", "cancel"
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    resourceIdx: index("permissions_resource_idx").on(table.resource),
    nameIdx: index("permissions_name_idx").on(table.name),
  })
);

// Role Permissions junction table (maps roles to permissions)
export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: varchar("role", { length: 20 }).notNull(), // 'customer', 'admin', 'support', 'developer'
    permissionId: uuid("permission_id")
      .references(() => permissions.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    roleIdx: index("role_permissions_role_idx").on(table.role),
    permissionIdIdx: index("role_permissions_permission_id_idx").on(
      table.permissionId
    ),
    uniqueRolePermission: index("role_permissions_unique_idx").on(
      table.role,
      table.permissionId
    ),
  })
);

// User Permissions table (for custom per-user permissions - optional)
export const userPermissions = pgTable(
  "user_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    permissionId: uuid("permission_id")
      .references(() => permissions.id, { onDelete: "cascade" })
      .notNull(),
    grantedBy: uuid("granted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index("user_permissions_user_id_idx").on(table.userId),
    permissionIdIdx: index("user_permissions_permission_id_idx").on(
      table.permissionId
    ),
    expiresAtIdx: index("user_permissions_expires_at_idx").on(table.expiresAt),
  })
);

// ============================================================================
// BUSINESS LOGIC - CUSTOMERS & SUBSCRIPTIONS
// ============================================================================

// Customers table
export const customers = pgTable(
  "customers",
  {
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
    status: varchar("status", { length: 20 }).default("active"), // 'active', 'suspended', 'cancelled'
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index("customers_user_id_idx").on(table.userId),
    stripeCustomerIdIdx: index("customers_stripe_customer_id_idx").on(
      table.stripeCustomerId
    ),
    statusIdx: index("customers_status_idx").on(table.status),
  })
);

// Subscriptions table
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .references(() => customers.id, { onDelete: "cascade" })
      .notNull(),
    planId: varchar("plan_id", { length: 100 }),
    planType: varchar("plan_type", { length: 20 }), // DEPRECATED: Use planId instead
    billingCycle: varchar("billing_cycle", { length: 10 }), // 'monthly', 'annual'
    price: decimal("price", { precision: 10, scale: 2 }),
    status: varchar("status", { length: 20 }), // 'active', 'past_due', 'cancelled', 'trialing', 'paused'
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    nextBillingDate: timestamp("next_billing_date", { withTimezone: true }),
    autoRenew: boolean("auto_renew").default(true).notNull(),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
    trialStart: timestamp("trial_start", { withTimezone: true }),
    trialEnd: timestamp("trial_end", { withTimezone: true }),
    quantity: integer("quantity").default(1),
    metadata: jsonb("metadata"),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    trialPlanChanges: integer("trial_plan_changes").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    customerIdIdx: index("subscriptions_customer_id_idx").on(table.customerId),
    stripeSubscriptionIdIdx: index(
      "subscriptions_stripe_subscription_id_idx"
    ).on(table.stripeSubscriptionId),
    statusIdx: index("subscriptions_status_idx").on(table.status),
    currentPeriodEndIdx: index("subscriptions_current_period_end_idx").on(
      table.currentPeriodEnd
    ),
  })
);

// Subscription changes table (audit trail)
export const subscriptionChanges = pgTable(
  "subscription_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriptionId: uuid("subscription_id")
      .references(() => subscriptions.id, { onDelete: "cascade" })
      .notNull(),
    customerId: uuid("customer_id")
      .references(() => customers.id, { onDelete: "cascade" })
      .notNull(),
    changeType: varchar("change_type", { length: 50 }).notNull(),
    previousPlanId: varchar("previous_plan_id", { length: 100 }),
    newPlanId: varchar("new_plan_id", { length: 100 }),
    previousBillingCycle: varchar("previous_billing_cycle", { length: 10 }),
    newBillingCycle: varchar("new_billing_cycle", { length: 10 }),
    previousPrice: decimal("previous_price", { precision: 10, scale: 2 }),
    newPrice: decimal("new_price", { precision: 10, scale: 2 }),
    prorationAmount: decimal("proration_amount", { precision: 10, scale: 2 }),
    effectiveDate: timestamp("effective_date", {
      withTimezone: true,
    }).notNull(),
    reason: text("reason"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    subscriptionIdIdx: index("subscription_changes_subscription_id_idx").on(
      table.subscriptionId
    ),
    customerIdIdx: index("subscription_changes_customer_id_idx").on(
      table.customerId
    ),
    changeTypeIdx: index("subscription_changes_change_type_idx").on(
      table.changeType
    ),
    createdAtIdx: index("subscription_changes_created_at_idx").on(
      table.createdAt
    ),
  })
);

// ============================================================================
// BUSINESS LOGIC - LICENSES & ACTIVATIONS
// ============================================================================

// License keys table
export const licenseKeys = pgTable(
  "license_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .references(() => customers.id, { onDelete: "cascade" })
      .notNull(),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    licenseKey: varchar("license_key", { length: 50 }).notNull().unique(),
    maxTerminals: integer("max_terminals").default(1).notNull(),
    activationCount: integer("activation_count").default(0).notNull(),
    version: varchar("version", { length: 10 }).default("1.0"),
    isActive: boolean("is_active").default(true).notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revocationReason: text("revocation_reason"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    customerIdIdx: index("license_keys_customer_id_idx").on(table.customerId),
    subscriptionIdIdx: index("license_keys_subscription_id_idx").on(
      table.subscriptionId
    ),
    isActiveIdx: index("license_keys_is_active_idx").on(table.isActive),
    expiresAtIdx: index("license_keys_expires_at_idx").on(table.expiresAt),
  })
);

// Activations table
export const activations = pgTable(
  "activations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    licenseKey: varchar("license_key", { length: 50 })
      .references(() => licenseKeys.licenseKey, { onDelete: "cascade" })
      .notNull(),
    machineIdHash: varchar("machine_id_hash", { length: 128 }),
    terminalName: varchar("terminal_name", { length: 100 }),
    isActive: boolean("is_active").default(true).notNull(),
    firstActivation: timestamp("first_activation", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastHeartbeat: timestamp("last_heartbeat", { withTimezone: true }),
    ipAddress: inet("ip_address"),
    location: jsonb("location"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    licenseKeyIdx: index("activations_license_key_idx").on(table.licenseKey),
    isActiveIdx: index("activations_is_active_idx").on(table.isActive),
    lastHeartbeatIdx: index("activations_last_heartbeat_idx").on(
      table.lastHeartbeat
    ),
  })
);

// ============================================================================
// BUSINESS LOGIC - PAYMENTS & BILLING
// ============================================================================

// Payments table
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .references(() => customers.id, { onDelete: "cascade" })
      .notNull(),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    paymentType: varchar("payment_type", { length: 20 }), // 'subscription', 'one-time', 'refund', 'upgrade'
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    status: varchar("status", { length: 20 }), // 'pending', 'completed', 'failed', 'refunded'
    stripePaymentId: varchar("stripe_payment_id", { length: 100 }),
    invoiceUrl: text("invoice_url"),
    billingPeriodStart: timestamp("billing_period_start", {
      withTimezone: true,
    }),
    billingPeriodEnd: timestamp("billing_period_end", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    customerIdIdx: index("payments_customer_id_idx").on(table.customerId),
    subscriptionIdIdx: index("payments_subscription_id_idx").on(
      table.subscriptionId
    ),
    statusIdx: index("payments_status_idx").on(table.status),
    createdAtIdx: index("payments_created_at_idx").on(table.createdAt),
    stripePaymentIdIdx: index("payments_stripe_payment_id_idx").on(
      table.stripePaymentId
    ),
  })
);

// Payment Methods table (PCI-compliant: stores only last 4 digits)
export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .references(() => customers.id, { onDelete: "cascade" })
      .notNull(),

    // Stripe IDs
    stripePaymentMethodId: varchar("stripe_payment_method_id", { length: 100 })
      .unique()
      .notNull(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 100 }).notNull(),

    // Payment Method Details (PCI-compliant: NO full card numbers!)
    type: varchar("type", { length: 20 }).notNull(),
    brand: varchar("brand", { length: 20 }),
    last4: varchar("last4", { length: 4 }),
    expMonth: integer("exp_month"),
    expYear: integer("exp_year"),
    funding: varchar("funding", { length: 20 }),
    country: varchar("country", { length: 2 }),

    // Status
    isDefault: boolean("is_default").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    customerIdIdx: index("payment_methods_customer_id_idx").on(
      table.customerId
    ),
    stripePmIdIdx: index("payment_methods_stripe_pm_id_idx").on(
      table.stripePaymentMethodId
    ),
    isDefaultIdx: index("payment_methods_is_default_idx").on(table.isDefault),
  })
);

// Invoices table - Complete invoice tracking with all Stripe invoice data
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .references(() => customers.id, { onDelete: "cascade" })
      .notNull(),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),

    stripeInvoiceId: varchar("stripe_invoice_id", { length: 100 })
      .unique()
      .notNull(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 100 }).notNull(),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 100 }),

    number: varchar("number", { length: 50 }),
    status: varchar("status", { length: 20 }).notNull(),

    subtotal: integer("subtotal").notNull(),
    tax: integer("tax").default(0),
    total: integer("total").notNull(),
    amountDue: integer("amount_due").notNull(),
    amountPaid: integer("amount_paid").default(0),
    amountRemaining: integer("amount_remaining").default(0),
    currency: varchar("currency", { length: 3 }).default("usd").notNull(),

    hostedInvoiceUrl: text("hosted_invoice_url"),
    invoicePdf: text("invoice_pdf"),

    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),

    description: text("description"),
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    customerIdIdx: index("invoices_customer_id_idx").on(table.customerId),
    stripeInvoiceIdIdx: index("invoices_stripe_invoice_id_idx").on(
      table.stripeInvoiceId
    ),
    statusIdx: index("invoices_status_idx").on(table.status),
  })
);

// Invoice line items table
export const invoiceLineItems = pgTable(
  "invoice_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .references(() => invoices.id, { onDelete: "cascade" })
      .notNull(),

    description: text("description").notNull(),
    quantity: integer("quantity").default(1).notNull(),
    unitAmount: integer("unit_amount").notNull(),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).default("usd").notNull(),

    stripeLineItemId: varchar("stripe_line_item_id", { length: 100 }),
    stripePriceId: varchar("stripe_price_id", { length: 100 }),

    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    invoiceIdIdx: index("invoice_line_items_invoice_id_idx").on(
      table.invoiceId
    ),
  })
);

// ============================================================================
// CUSTOMER SUPPORT
// ============================================================================

// Support tickets table
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .references(() => customers.id, { onDelete: "cascade" })
      .notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    category: varchar("category", { length: 50 }).notNull(), // 'technical', 'billing', 'license', 'installation', 'feature', 'other'
    priority: varchar("priority", { length: 20 }).notNull(), // 'low', 'medium', 'high', 'urgent'
    status: varchar("status", { length: 20 }).default("open").notNull(), // 'open', 'in_progress', 'resolved', 'closed'
    message: text("message").notNull(),
    response: text("response"),
    respondedBy: uuid("responded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    customerIdIdx: index("support_tickets_customer_id_idx").on(
      table.customerId
    ),
    statusIdx: index("support_tickets_status_idx").on(table.status),
    priorityIdx: index("support_tickets_priority_idx").on(table.priority),
    respondedByIdx: index("support_tickets_responded_by_idx").on(
      table.respondedBy
    ),
    createdAtIdx: index("support_tickets_created_at_idx").on(table.createdAt),
  })
);

// ============================================================================
// INTEGRATIONS - STRIPE
// ============================================================================

// Webhook events table (for idempotency)
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stripeEventId: varchar("stripe_event_id", { length: 255 })
      .notNull()
      .unique(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    processed: boolean("processed").default(true).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    eventTypeIdx: index("webhook_events_event_type_idx").on(table.eventType),
    processedIdx: index("webhook_events_processed_idx").on(table.processed),
    createdAtIdx: index("webhook_events_created_at_idx").on(table.createdAt),
  })
);

// ============================================================================
// SSE SUBSCRIPTION EVENTS (Event Replay & Persistence)
// ============================================================================

/**
 * Subscription Events Table
 *
 * Stores all SSE events for 24 hours to enable event replay when desktop
 * apps reconnect after disconnection. Prevents missing critical subscription
 * changes during network issues.
 *
 * Retention: 24 hours (auto-cleanup via cron)
 * Purpose: Event persistence for missed event recovery
 */
export const subscriptionEvents = pgTable(
  "subscription_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Unique event ID from SSE event (for idempotency)
    eventId: varchar("event_id", { length: 100 }).notNull().unique(),
    // License key this event belongs to
    licenseKey: varchar("license_key", { length: 100 }).notNull(),
    // Event type (subscription_cancelled, plan_changed, etc.)
    eventType: varchar("event_type", { length: 50 }).notNull(),
    // Full event payload (JSON)
    payload: jsonb("payload").notNull(),
    // When the event was created
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // When the event expires (24 hours from creation)
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    // Index for querying events by license key and time range
    licenseKeyCreatedAtIdx: index("subscription_events_license_created_idx").on(
      table.licenseKey,
      table.createdAt
    ),
    // Index for cleanup job (find expired events)
    expiresAtIdx: index("subscription_events_expires_at_idx").on(
      table.expiresAt
    ),
    // Index for event type analytics
    eventTypeIdx: index("subscription_events_event_type_idx").on(
      table.eventType
    ),
  })
);

// ============================================================================
// EVENT ACKNOWLEDGMENTS (Phase 4: Event Durability & Reliability)
// ============================================================================

/**
 * Event Acknowledgments Table
 * Tracks successful processing of subscription events by desktop clients
 */
export const eventAcknowledgments = pgTable(
  "event_acknowledgments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Reference to the event that was acknowledged
    eventId: varchar("event_id", { length: 100 }).notNull(),
    // Which license/desktop acknowledged this event
    licenseKey: varchar("license_key", { length: 100 }).notNull(),
    // Machine ID hash for multi-terminal tracking (MF2- prefix + 64 char SHA256 = 68 chars, use 128 for safety)
    machineIdHash: varchar("machine_id_hash", { length: 128 }),
    // When the event was acknowledged
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Processing result: success, failed, skipped
    status: varchar("status", { length: 20 }).notNull().default("success"),
    // Error message if processing failed
    errorMessage: text("error_message"),
    // Processing time in milliseconds
    processingTimeMs: integer("processing_time_ms"),
  },
  (table) => ({
    // Composite unique constraint: one ACK per event per machine
    eventMachineUniqueIdx: index("event_acknowledgments_event_machine_idx").on(
      table.eventId,
      table.machineIdHash
    ),
    // Index for querying ACKs by license
    licenseKeyIdx: index("event_acknowledgments_license_key_idx").on(
      table.licenseKey
    ),
    // Index for cleanup (find old ACKs)
    acknowledgedAtIdx: index("event_acknowledgments_acknowledged_at_idx").on(
      table.acknowledgedAt
    ),
  })
);

// ============================================================================
// DEAD LETTER QUEUE (Phase 4: Event Durability & Reliability)
// ============================================================================

/**
 * Dead Letter Queue Table
 * Stores events that failed to be processed after maximum retry attempts
 */
export const deadLetterQueue = pgTable(
  "dead_letter_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Original event ID
    eventId: varchar("event_id", { length: 100 }).notNull().unique(),
    // License key this event was for
    licenseKey: varchar("license_key", { length: 100 }).notNull(),
    // Event type
    eventType: varchar("event_type", { length: 50 }).notNull(),
    // Original event payload
    payload: jsonb("payload").notNull(),
    // When the event was originally created
    originalCreatedAt: timestamp("original_created_at", {
      withTimezone: true,
    }).notNull(),
    // When the event was moved to DLQ
    failedAt: timestamp("failed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Number of retry attempts made
    retryCount: integer("retry_count").notNull().default(0),
    // Last error message
    lastErrorMessage: text("last_error_message"),
    // Last error timestamp
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
    // Status: pending_review, retrying, resolved, abandoned
    status: varchar("status", { length: 20 })
      .notNull()
      .default("pending_review"),
    // Resolution notes (if manually resolved)
    resolutionNotes: text("resolution_notes"),
    // Who resolved it (employee ID)
    resolvedBy: uuid("resolved_by"),
    // When it was resolved
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => ({
    // Index for querying DLQ by license
    licenseKeyIdx: index("dead_letter_queue_license_key_idx").on(
      table.licenseKey
    ),
    // Index for querying by status
    statusIdx: index("dead_letter_queue_status_idx").on(table.status),
    // Index for querying by failure time
    failedAtIdx: index("dead_letter_queue_failed_at_idx").on(table.failedAt),
  })
);

// ============================================================================
// EVENT RETRY HISTORY (Phase 4: Event Durability & Reliability)
// ============================================================================

/**
 * Event Retry History Table
 * Tracks all retry attempts for failed events
 */
export const eventRetryHistory = pgTable(
  "event_retry_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Reference to the event being retried
    eventId: varchar("event_id", { length: 100 }).notNull(),
    // Retry attempt number (1, 2, 3, etc.)
    attemptNumber: integer("attempt_number").notNull(),
    // When this retry was attempted
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Result: success, failed, timeout
    result: varchar("result", { length: 20 }).notNull(),
    // Error message if failed
    errorMessage: text("error_message"),
    // Next retry scheduled time (if applicable)
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    // Backoff delay in milliseconds
    backoffDelayMs: integer("backoff_delay_ms"),
  },
  (table) => ({
    // Index for querying retry history by event
    eventIdIdx: index("event_retry_history_event_id_idx").on(table.eventId),
    // Index for finding next retries to process
    nextRetryAtIdx: index("event_retry_history_next_retry_at_idx").on(
      table.nextRetryAt
    ),
  })
);

// ============================================================================
// FAILURE PATTERN ANALYTICS (Phase 5: Advanced Analytics)
// ============================================================================

/**
 * License Health Metrics Table
 * Aggregated health scores and analytics for each license
 */
export const licenseHealthMetrics = pgTable(
  "license_health_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // License key this metric belongs to
    licenseKey: varchar("license_key", { length: 100 }).notNull().unique(),
    // Overall health score (0-100)
    healthScore: integer("health_score").notNull().default(100),
    // Event success rate (0-100)
    eventSuccessRate: decimal("event_success_rate", {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default("100.00"),
    // Average processing time in milliseconds
    avgProcessingTimeMs: integer("avg_processing_time_ms"),
    // Total events processed
    totalEventsProcessed: integer("total_events_processed")
      .notNull()
      .default(0),
    // Total failures
    totalFailures: integer("total_failures").notNull().default(0),
    // Total retries
    totalRetries: integer("total_retries").notNull().default(0),
    // Total DLQ events
    totalDlqEvents: integer("total_dlq_events").notNull().default(0),
    // Last event timestamp
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    // Last failure timestamp
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    // Health status: healthy, degraded, critical, inactive
    healthStatus: varchar("health_status", { length: 20 })
      .notNull()
      .default("healthy"),
    // Common failure patterns (JSON array of pattern descriptions)
    failurePatterns: jsonb("failure_patterns"),
    // Performance trend: improving, stable, degrading
    performanceTrend: varchar("performance_trend", { length: 20 }).default(
      "stable"
    ),
    // Updated timestamp
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Index for querying by health status
    healthStatusIdx: index("license_health_metrics_health_status_idx").on(
      table.healthStatus
    ),
    // Index for sorting by health score
    healthScoreIdx: index("license_health_metrics_health_score_idx").on(
      table.healthScore
    ),
    // Index for finding inactive licenses
    lastEventAtIdx: index("license_health_metrics_last_event_at_idx").on(
      table.lastEventAt
    ),
  })
);

/**
 * Failure Pattern Analysis Table
 * Tracks detected failure patterns across the system
 */
export const failurePatterns = pgTable(
  "failure_patterns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Pattern identifier (e.g., "network_timeout_burst")
    patternId: varchar("pattern_id", { length: 100 }).notNull(),
    // License key (null if system-wide pattern)
    licenseKey: varchar("license_key", { length: 100 }),
    // Pattern type: timeout, network, parsing, rate_limit, etc.
    patternType: varchar("pattern_type", { length: 50 }).notNull(),
    // Pattern description
    description: text("description").notNull(),
    // Severity: low, medium, high, critical
    severity: varchar("severity", { length: 20 }).notNull(),
    // Occurrence count
    occurrenceCount: integer("occurrence_count").notNull().default(1),
    // First detected timestamp
    firstDetectedAt: timestamp("first_detected_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Last detected timestamp
    lastDetectedAt: timestamp("last_detected_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Pattern metadata (error codes, affected event types, etc.)
    metadata: jsonb("metadata"),
    // Status: active, resolved, monitoring
    status: varchar("status", { length: 20 }).notNull().default("active"),
    // Resolution notes
    resolutionNotes: text("resolution_notes"),
  },
  (table) => ({
    // Index for querying patterns by license
    licenseKeyIdx: index("failure_patterns_license_key_idx").on(
      table.licenseKey
    ),
    // Index for querying by pattern type
    patternTypeIdx: index("failure_patterns_pattern_type_idx").on(
      table.patternType
    ),
    // Index for querying by severity
    severityIdx: index("failure_patterns_severity_idx").on(table.severity),
    // Index for querying by status
    statusIdx: index("failure_patterns_status_idx").on(table.status),
  })
);

/**
 * Performance Metrics Table
 * Time-series performance data for trending analysis
 */
export const performanceMetrics = pgTable(
  "performance_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // License key (null if system-wide metric)
    licenseKey: varchar("license_key", { length: 100 }),
    // Metric timestamp (hourly aggregation)
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    // Events processed in this period
    eventsProcessed: integer("events_processed").notNull().default(0),
    // Successful events
    successfulEvents: integer("successful_events").notNull().default(0),
    // Failed events
    failedEvents: integer("failed_events").notNull().default(0),
    // Average processing time in milliseconds
    avgProcessingTimeMs: integer("avg_processing_time_ms"),
    // Min processing time in milliseconds
    minProcessingTimeMs: integer("min_processing_time_ms"),
    // Max processing time in milliseconds
    maxProcessingTimeMs: integer("max_processing_time_ms"),
    // P95 processing time in milliseconds
    p95ProcessingTimeMs: integer("p95_processing_time_ms"),
    // Events retried in this period
    eventsRetried: integer("events_retried").notNull().default(0),
    // Events moved to DLQ in this period
    eventsToDlq: integer("events_to_dlq").notNull().default(0),
  },
  (table) => ({
    // Composite index for time-series queries
    licenseTimestampIdx: index("performance_metrics_license_timestamp_idx").on(
      table.licenseKey,
      table.timestamp
    ),
    // Index for system-wide metrics
    timestampIdx: index("performance_metrics_timestamp_idx").on(
      table.timestamp
    ),
  })
);

// ============================================================================
// MULTI-TERMINAL COORDINATION (Phase 6)
// ============================================================================

/**
 * Terminal Sessions Table
 * Tracks all active desktop terminal sessions under each subscription
 */
export const terminalSessions = pgTable(
  "terminal_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // License key for this terminal
    licenseKey: varchar("license_key", { length: 100 }).notNull(),
    // Machine ID hash (unique identifier for this terminal)
    machineIdHash: varchar("machine_id_hash", { length: 64 }).notNull(),
    // Terminal name/identifier (for display)
    terminalName: varchar("terminal_name", { length: 100 }),
    // Machine hostname
    hostname: varchar("hostname", { length: 255 }),
    // IP address
    ipAddress: varchar("ip_address", { length: 45 }),
    // Desktop app version
    appVersion: varchar("app_version", { length: 50 }),
    // Connection status: connected, disconnected, deactivated
    connectionStatus: varchar("connection_status", { length: 20 })
      .notNull()
      .default("connected"),
    // When this terminal first connected
    firstConnectedAt: timestamp("first_connected_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Last connected timestamp
    lastConnectedAt: timestamp("last_connected_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Last heartbeat timestamp
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Disconnected timestamp (if applicable)
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    // Deactivated timestamp (if license deactivated)
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    // Is this the primary terminal?
    isPrimary: boolean("is_primary").notNull().default(false),
    // Session metadata (OS info, hardware info, etc.)
    metadata: jsonb("metadata"),
  },
  (table) => ({
    // Composite index for active sessions by license
    licenseStatusIdx: index("terminal_sessions_license_status_idx").on(
      table.licenseKey,
      table.connectionStatus
    ),
    // Unique constraint: one session per machine per license
    machineLicenseUniqueIdx: index("terminal_sessions_machine_license_idx").on(
      table.machineIdHash,
      table.licenseKey
    ),
    // Index for finding stale sessions
    lastHeartbeatIdx: index("terminal_sessions_last_heartbeat_idx").on(
      table.lastHeartbeatAt
    ),
  })
);

/**
 * Terminal State Sync Table
 * Tracks state synchronization across multiple terminals
 */
export const terminalStateSync = pgTable(
  "terminal_state_sync",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // License key for this sync operation
    licenseKey: varchar("license_key", { length: 100 }).notNull(),
    // State sync type: subscription_change, terminal_deactivation, config_update
    syncType: varchar("sync_type", { length: 50 }).notNull(),
    // Source terminal (which terminal initiated the sync)
    sourceMachineIdHash: varchar("source_machine_id_hash", { length: 64 }),
    // Target terminals (null means broadcast to all)
    targetMachineIdHashes: jsonb("target_machine_id_hashes"),
    // Sync payload (state data to synchronize)
    payload: jsonb("payload").notNull(),
    // Sync status: pending, in_progress, completed, failed
    syncStatus: varchar("sync_status", { length: 20 })
      .notNull()
      .default("pending"),
    // When sync was initiated
    initiatedAt: timestamp("initiated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // When sync completed
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Acknowledgments received (array of machine ID hashes)
    acknowledgedBy: jsonb("acknowledged_by"),
    // Error message if failed
    errorMessage: text("error_message"),
  },
  (table) => ({
    // Index for querying syncs by license
    licenseKeyIdx: index("terminal_state_sync_license_key_idx").on(
      table.licenseKey
    ),
    // Index for querying by status
    syncStatusIdx: index("terminal_state_sync_status_idx").on(table.syncStatus),
    // Index for finding pending syncs
    initiatedAtIdx: index("terminal_state_sync_initiated_at_idx").on(
      table.initiatedAt
    ),
  })
);

/**
 * Terminal Coordination Events Table
 * Stores coordination events for multi-terminal scenarios
 */
export const terminalCoordinationEvents = pgTable(
  "terminal_coordination_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // License key
    licenseKey: varchar("license_key", { length: 100 }).notNull(),
    // Event type: terminal_added, terminal_removed, primary_changed, deactivation_broadcast
    eventType: varchar("event_type", { length: 50 }).notNull(),
    // Affected terminal
    machineIdHash: varchar("machine_id_hash", { length: 64 }),
    // Event payload
    payload: jsonb("payload").notNull(),
    // When the event occurred
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Is this event broadcast to all terminals?
    isBroadcast: boolean("is_broadcast").notNull().default(false),
    // Delivery status by terminal (JSON object: {machineHash: 'delivered'|'pending'|'failed'})
    deliveryStatus: jsonb("delivery_status"),
  },
  (table) => ({
    // Index for querying events by license
    licenseKeyIdx: index("terminal_coordination_events_license_key_idx").on(
      table.licenseKey
    ),
    // Index for querying by event type
    eventTypeIdx: index("terminal_coordination_events_event_type_idx").on(
      table.eventType
    ),
    // Index for time-based queries
    occurredAtIdx: index("terminal_coordination_events_occurred_at_idx").on(
      table.occurredAt
    ),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

// Auth Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  employee: one(employees, {
    fields: [users.id],
    references: [employees.userId],
  }),
  customer: one(customers, {
    fields: [users.id],
    references: [customers.userId],
  }),
  userPermissions: many(userPermissions),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// RBAC Relations
export const employeesRelations = relations(employees, ({ one }) => ({
  user: one(users, {
    fields: [employees.userId],
    references: [users.id],
  }),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  userPermissions: many(userPermissions),
}));

export const rolePermissionsRelations = relations(
  rolePermissions,
  ({ one }) => ({
    permission: one(permissions, {
      fields: [rolePermissions.permissionId],
      references: [permissions.id],
    }),
  })
);

export const userPermissionsRelations = relations(
  userPermissions,
  ({ one }) => ({
    user: one(users, {
      fields: [userPermissions.userId],
      references: [users.id],
    }),
    permission: one(permissions, {
      fields: [userPermissions.permissionId],
      references: [permissions.id],
    }),
    grantedByUser: one(users, {
      fields: [userPermissions.grantedBy],
      references: [users.id],
    }),
  })
);

// Business Logic Relations
export const customersRelations = relations(customers, ({ one, many }) => ({
  user: one(users, {
    fields: [customers.userId],
    references: [users.id],
  }),
  subscriptions: many(subscriptions),
  licenseKeys: many(licenseKeys),
  payments: many(payments),
  subscriptionChanges: many(subscriptionChanges),
  supportTickets: many(supportTickets),
}));

export const subscriptionsRelations = relations(
  subscriptions,
  ({ one, many }) => ({
    customer: one(customers, {
      fields: [subscriptions.customerId],
      references: [customers.id],
    }),
    licenseKeys: many(licenseKeys),
    payments: many(payments),
    subscriptionChanges: many(subscriptionChanges),
  })
);

export const subscriptionChangesRelations = relations(
  subscriptionChanges,
  ({ one }) => ({
    subscription: one(subscriptions, {
      fields: [subscriptionChanges.subscriptionId],
      references: [subscriptions.id],
    }),
    customer: one(customers, {
      fields: [subscriptionChanges.customerId],
      references: [customers.id],
    }),
  })
);

export const licenseKeysRelations = relations(licenseKeys, ({ one, many }) => ({
  customer: one(customers, {
    fields: [licenseKeys.customerId],
    references: [customers.id],
  }),
  subscription: one(subscriptions, {
    fields: [licenseKeys.subscriptionId],
    references: [subscriptions.id],
  }),
  activations: many(activations),
}));

export const activationsRelations = relations(activations, ({ one }) => ({
  licenseKey: one(licenseKeys, {
    fields: [activations.licenseKey],
    references: [licenseKeys.licenseKey],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  customer: one(customers, {
    fields: [payments.customerId],
    references: [customers.id],
  }),
  subscription: one(subscriptions, {
    fields: [payments.subscriptionId],
    references: [subscriptions.id],
  }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  customer: one(customers, {
    fields: [supportTickets.customerId],
    references: [customers.id],
  }),
  respondedByUser: one(users, {
    fields: [supportTickets.respondedBy],
    references: [users.id],
  }),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({ one }) => ({
  customer: one(customers, {
    fields: [paymentMethods.customerId],
    references: [customers.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  subscription: one(subscriptions, {
    fields: [invoices.subscriptionId],
    references: [subscriptions.id],
  }),
  lineItems: many(invoiceLineItems),
}));

export const invoiceLineItemsRelations = relations(
  invoiceLineItems,
  ({ one }) => ({
    invoice: one(invoices, {
      fields: [invoiceLineItems.invoiceId],
      references: [invoices.id],
    }),
  })
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Auth Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type NewVerificationToken = typeof verificationTokens.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// RBAC Types
export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
export type UserPermission = typeof userPermissions.$inferSelect;
export type NewUserPermission = typeof userPermissions.$inferInsert;

// Business Logic Types
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type SubscriptionChange = typeof subscriptionChanges.$inferSelect;
export type NewSubscriptionChange = typeof subscriptionChanges.$inferInsert;
export type LicenseKey = typeof licenseKeys.$inferSelect;
export type NewLicenseKey = typeof licenseKeys.$inferInsert;
export type Activation = typeof activations.$inferSelect;
export type NewActivation = typeof activations.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type NewInvoiceLineItem = typeof invoiceLineItems.$inferInsert;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type NewSupportTicket = typeof supportTickets.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
export type SubscriptionEvent = typeof subscriptionEvents.$inferSelect;
export type NewSubscriptionEvent = typeof subscriptionEvents.$inferInsert;

// Event Durability Types (Phase 4)
export type EventAcknowledgment = typeof eventAcknowledgments.$inferSelect;
export type NewEventAcknowledgment = typeof eventAcknowledgments.$inferInsert;
export type DeadLetterQueueItem = typeof deadLetterQueue.$inferSelect;
export type NewDeadLetterQueueItem = typeof deadLetterQueue.$inferInsert;
export type EventRetryHistory = typeof eventRetryHistory.$inferSelect;
export type NewEventRetryHistory = typeof eventRetryHistory.$inferInsert;

// Advanced Analytics Types (Phase 5)
export type LicenseHealthMetric = typeof licenseHealthMetrics.$inferSelect;
export type NewLicenseHealthMetric = typeof licenseHealthMetrics.$inferInsert;
export type FailurePattern = typeof failurePatterns.$inferSelect;
export type NewFailurePattern = typeof failurePatterns.$inferInsert;
export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type NewPerformanceMetric = typeof performanceMetrics.$inferInsert;

// Multi-Terminal Coordination Types (Phase 6)
export type TerminalSession = typeof terminalSessions.$inferSelect;
export type NewTerminalSession = typeof terminalSessions.$inferInsert;
export type TerminalStateSync = typeof terminalStateSync.$inferSelect;
export type NewTerminalStateSync = typeof terminalStateSync.$inferInsert;
export type TerminalCoordinationEvent =
  typeof terminalCoordinationEvents.$inferSelect;
export type NewTerminalCoordinationEvent =
  typeof terminalCoordinationEvents.$inferInsert;
