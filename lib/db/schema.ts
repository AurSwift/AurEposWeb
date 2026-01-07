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
export type SupportTicket = typeof supportTickets.$inferSelect;
export type NewSupportTicket = typeof supportTickets.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
