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

// Customers table
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique()
    .notNull(), // One customer per user (one-to-one relationship)
  companyName: varchar("company_name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  billingAddress: jsonb("billing_address"),
  taxId: varchar("tax_id", { length: 50 }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  status: varchar("status", { length: 20 }), // 'active', 'suspended', 'cancelled'
});

// Subscriptions table
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .references(() => customers.id)
      .notNull(),
    planId: varchar("plan_id", { length: 100 }), // Reference to plan catalog (e.g., 'basic', 'professional', 'enterprise')
    planType: varchar("plan_type", { length: 20 }), // 'basic', 'professional', 'enterprise' (deprecated, use planId)
    billingCycle: varchar("billing_cycle", { length: 10 }), // 'monthly', 'annual'
    price: decimal("price", { precision: 10, scale: 2 }),
    status: varchar("status", { length: 20 }), // 'active', 'past_due', 'cancelled', 'trialing', 'paused'
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    nextBillingDate: timestamp("next_billing_date", { withTimezone: true }),
    autoRenew: boolean("auto_renew").default(true).notNull(),
    canceledAt: timestamp("canceled_at", { withTimezone: true }), // When subscription was canceled
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false), // Cancel at end of billing period
    trialStart: timestamp("trial_start", { withTimezone: true }), // Trial period start
    trialEnd: timestamp("trial_end", { withTimezone: true }), // Trial period end
    quantity: integer("quantity").default(1), // Multi-seat support
    metadata: jsonb("metadata"), // Custom plan features, limits, etc.
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    customerIdIdx: index("subscriptions_customer_id_idx").on(table.customerId),
    stripeSubscriptionIdIdx: index("subscriptions_stripe_subscription_id_idx").on(
      table.stripeSubscriptionId
    ),
    statusIdx: index("subscriptions_status_idx").on(table.status),
  })
);

// License keys table
export const licenseKeys = pgTable("license_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .references(() => customers.id)
    .notNull(),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
  licenseKey: varchar("license_key", { length: 50 }).notNull().unique(),
  maxTerminals: integer("max_terminals").default(1).notNull(),
  activationCount: integer("activation_count").default(0).notNull(),
  version: varchar("version", { length: 10 }).default("1.0"), // License key format version
  issuedAt: timestamp("issued_at", { withTimezone: true })
    .defaultNow()
    .notNull(), // When license was issued
  expiresAt: timestamp("expires_at", { withTimezone: true }), // License expiration date (null = never expires)
  revokedAt: timestamp("revoked_at", { withTimezone: true }), // When license was revoked
  revocationReason: text("revocation_reason"), // Why license was revoked
  notes: text("notes"), // Admin notes
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

// Activations table
export const activations = pgTable("activations", {
  id: uuid("id").primaryKey().defaultRandom(),
  licenseKey: varchar("license_key", { length: 50 })
    .references(() => licenseKeys.licenseKey)
    .notNull(),
  machineIdHash: varchar("machine_id_hash", { length: 128 }),
  terminalName: varchar("terminal_name", { length: 100 }),
  firstActivation: timestamp("first_activation", { withTimezone: true })
    .defaultNow()
    .notNull(),
  lastHeartbeat: timestamp("last_heartbeat", { withTimezone: true }),
  isActive: boolean("is_active").default(true).notNull(),
  ipAddress: inet("ip_address"),
  location: jsonb("location"), // city, country from IP
});

// Payments table
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .references(() => customers.id)
      .notNull(),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }), // Link payment to subscription
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
  })
);

// Subscription changes table (audit trail)
export const subscriptionChanges = pgTable(
  "subscription_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriptionId: uuid("subscription_id")
      .references(() => subscriptions.id)
      .notNull(),
    customerId: uuid("customer_id")
      .references(() => customers.id)
      .notNull(),
    changeType: varchar("change_type", { length: 50 }).notNull(),
    // 'plan_upgrade', 'plan_downgrade', 'cycle_change', 'cancellation',
    // 'reactivation', 'trial_started', 'trial_ended', 'plan_change'

    previousPlanId: varchar("previous_plan_id", { length: 100 }),
    newPlanId: varchar("new_plan_id", { length: 100 }),
    previousBillingCycle: varchar("previous_billing_cycle", { length: 10 }),
    newBillingCycle: varchar("new_billing_cycle", { length: 10 }),
    previousPrice: decimal("previous_price", { precision: 10, scale: 2 }),
    newPrice: decimal("new_price", { precision: 10, scale: 2 }),

    prorationAmount: decimal("proration_amount", { precision: 10, scale: 2 }),
    effectiveDate: timestamp("effective_date", { withTimezone: true }).notNull(),
    reason: text("reason"), // User-provided or system reason
    metadata: jsonb("metadata"), // Additional change details

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
  })
);

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
    metadata: jsonb("metadata"), // Event data for debugging
  },
  (table) => ({
    eventTypeIdx: index("webhook_events_event_type_idx").on(table.eventType),
  })
);

// Users table for NextAuth authentication
// Compatible with NextAuth.js v5 Drizzle adapter
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

// Support tickets table
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .references(() => customers.id)
      .notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    category: varchar("category", { length: 50 }).notNull(), // 'technical', 'billing', 'license', 'installation', 'feature', 'other'
    priority: varchar("priority", { length: 20 }).notNull(), // 'low', 'medium', 'high', 'urgent'
    message: text("message").notNull(),
    status: varchar("status", { length: 20 }).default("open").notNull(), // 'open', 'in_progress', 'resolved', 'closed'
    response: text("response"), // Admin response
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    respondedBy: uuid("responded_by"), // Admin user ID
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    customerIdIdx: index("support_tickets_customer_id_idx").on(table.customerId),
    statusIdx: index("support_tickets_status_idx").on(table.status),
    createdAtIdx: index("support_tickets_created_at_idx").on(table.createdAt),
  })
);

// Relations
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

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  customer: one(customers, {
    fields: [supportTickets.customerId],
    references: [customers.id],
  }),
}));

// NextAuth relations
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  // Note: customer relation is defined on customers table (one-to-one via userId)
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

// Type exports for TypeScript
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type LicenseKey = typeof licenseKeys.$inferSelect;
export type NewLicenseKey = typeof licenseKeys.$inferInsert;
export type Activation = typeof activations.$inferSelect;
export type NewActivation = typeof activations.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type SubscriptionChange = typeof subscriptionChanges.$inferSelect;
export type NewSubscriptionChange = typeof subscriptionChanges.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;

// Auth type exports
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
export type SupportTicket = typeof supportTickets.$inferSelect;
export type NewSupportTicket = typeof supportTickets.$inferInsert;
