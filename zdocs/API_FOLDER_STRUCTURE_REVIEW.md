# API Folder Structure Documentation

**Last Updated:** January 9, 2025  
**Status:** Current documentation of API structure

---

## Overview

This document describes the API folder structure for the Aurswift web application. The API follows a dual hybrid architecture pattern combining Direct API routes (user-initiated) with Webhook routes (Stripe-initiated) for subscription management.

---

## Folder Structure

```
/web/app/api/
├── admin/                      # Administrative operations
│   ├── customers/             # Admin customer management
│   ├── licenses/              # Admin license management
│   │   └── [licenseId]/
│   │       └── revoke/        # Revoke license
│   ├── stats/                 # Admin statistics
│   └── support/               # Admin support ticket management
│       └── [ticketId]/
│           └── respond/       # Respond to support ticket
│
├── analytics/                  # Analytics and reporting
│   ├── health/                # Health analytics
│   ├── patterns/              # Usage patterns
│   └── trends/                # Usage trends
│
├── auth/                       # Authentication & user management
│   ├── [...nextauth]/         # NextAuth.js handler
│   ├── forgot-password/       # Password recovery
│   ├── reset-password/        # Password reset
│   ├── signup/                # User registration
│   ├── verify-email/          # Email verification
│   └── resend-verification/   # Resend verification email
│
├── cron/                       # Scheduled background tasks
│   ├── analytics/             # Analytics processing
│   ├── cleanup-events/        # Event cleanup
│   ├── detect-stale-sessions/ # Detect stale SSE sessions
│   ├── expiration-check/      # Check expired subscriptions
│   ├── health-monitoring/     # Health monitoring
│   └── retry-events/          # Retry failed events
│
├── data/                       # Data operations
│   └── export/                # Export user data
│
├── dlq/                        # Dead Letter Queue management
│   ├── route.ts               # List DLQ items & stats
│   ├── resolve/[eventId]/     # Resolve DLQ item
│   └── retry/[eventId]/       # Retry DLQ item
│
├── events/                     # Real-time event streaming
│   ├── [licenseKey]/          # SSE endpoint for license key
│   │   └── missed/            # Fetch missed events
│   └── acknowledge/           # Event acknowledgment
│
├── health/                     # Health check endpoints
│   └── sse/                   # SSE health check
│
├── invoices/                   # Invoice management
│   └── history/               # Invoice history
│
├── license/                    # License key management
│   ├── activate/              # Activate license
│   ├── deactivate/            # Deactivate license
│   ├── validate/              # Validate license
│   └── heartbeat/             # Keep-alive signal
│
├── monitoring/                 # System monitoring
│   ├── event-durability/      # Event durability monitoring
│   └── health/                # System health monitoring
│
├── payments/                   # Payment tracking
│   └── history/               # Payment history
│
├── profile/                    # User profile
│   └── route.ts               # Get/update user profile
│
├── releases/                   # Release management
│   └── latest/                # Get latest release info
│
├── stripe/                     # Stripe integration layer
│   ├── billing/               # Billing operations
│   │   ├── portal/            # Billing portal access
│   │   └── payment-method/    # Payment method management
│   ├── checkout/              # Checkout operations
│   │   └── create/            # Create checkout session
│   ├── subscriptions/         # Subscription sync operations
│   │   └── route.ts           # Subscription sync endpoint
│   ├── sync/                  # General Stripe sync
│   │   └── route.ts           # Sync payment methods & invoices
│   └── webhooks/              # Webhook handling
│       ├── handler/           # Main webhook handler
│       └── replay/            # Webhook replay
│
├── subscriptions/              # Subscription management
│   ├── cancel/                # Cancel subscription
│   ├── reactivate/            # Reactivate subscription
│   ├── change-plan/           # Change plan/billing
│   ├── current/               # Get current subscription
│   ├── history/               # Subscription change history
│   ├── billing-history/       # Billing records
│   ├── plans/                 # Plan information
│   └── preview-change/        # Preview plan change impact
│
├── support/                    # Support requests
│   └── route.ts               # Submit support ticket
│
├── terminal-sessions/          # Terminal session management
│   └── route.ts               # Terminal sessions operations
│
├── terminals/                  # Terminal management
│   ├── route.ts               # Get terminals
│   ├── broadcast/             # Broadcast to terminals
│   └── sync/                  # Sync terminal data
│
├── test/                       # Testing endpoints
│   ├── sse-status/            # SSE connection status test
│   └── trigger-revoke/        # Trigger license revocation test
│
└── user/                       # User information
    └── route.ts               # Get user details
```

---

## Route Categories

### Authentication Routes (`/auth/`)

**Purpose:** User authentication and account management

**Routes:**

- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/[...nextauth]` - NextAuth.js authentication endpoints
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/verify-email` - Verify email address
- `POST /api/auth/resend-verification` - Resend verification email

**Pattern:** Standard authentication flow with email verification

---

### Stripe Integration Routes (`/stripe/`)

**Purpose:** Direct Stripe API operations and webhook handling

**Organization:**

- **`checkout/`** - Checkout session creation
- **`subscriptions/`** - Subscription synchronization
- **`sync/`** - General Stripe data sync (payment methods, invoices)
- **`webhooks/`** - Webhook event processing
- **`billing/`** - Billing portal and payment method management

**Direct API Routes (User-Initiated):**

- `POST /api/stripe/checkout/create` - Create Stripe checkout session
- `POST /api/stripe/subscriptions` - Sync subscription from Stripe
- `POST /api/stripe/sync` - Sync payment methods and invoices from Stripe
- `POST /api/stripe/billing/portal` - Create billing portal session
- `GET /api/stripe/billing/payment-method` - Get payment methods

**Webhook Routes (Stripe-Initiated):**

- `POST /api/stripe/webhooks/handler` - Main webhook handler for Stripe events
- `POST /api/stripe/webhooks/replay` - Replay webhook events

**Supported Webhook Events:**

- `checkout.session.completed` - Creates subscription
- `customer.subscription.updated` - Updates subscription
- `customer.subscription.deleted` - Cancels subscription
- `invoice.payment_succeeded` - Records successful payment
- `invoice.payment_failed` - Marks subscription as past_due
- `customer.updated` - Updates customer data
- `customer.deleted` - Handles customer deletion
- `payment_method.attached` - Records payment method attachment
- `payment_method.detached` - Records payment method removal
- `invoice.created` / `invoice.updated` - Invoice lifecycle events
- `invoice.paid` - Invoice payment confirmation

---

### Subscription Management Routes (`/subscriptions/`)

**Purpose:** User-controlled subscription operations

**Routes:**

- `POST /api/subscriptions/cancel` - Cancel subscription immediately
- `POST /api/subscriptions/reactivate` - Reactivate cancelled subscription
- `POST /api/subscriptions/change-plan` - Change plan or billing cycle
- `POST /api/subscriptions/preview-change` - Preview plan change impact (proration)
- `GET /api/subscriptions/current` - Get current subscription
- `GET /api/subscriptions/history` - Get subscription change audit trail
- `GET /api/subscriptions/billing-history` - Get billing history
- `GET /api/subscriptions/plans` - Get available plans

**Pattern:** All routes require authentication and update database immediately after Stripe API calls

---

### License Management Routes (`/license/`)

**Purpose:** Desktop application license operations

**Routes:**

- `POST /api/license/activate` - Activate license on machine
- `POST /api/license/deactivate` - Deactivate license
- `POST /api/license/validate` - Validate license status
- `POST /api/license/heartbeat` - Send keep-alive signal

**Consumer:** Desktop Electron application  
**Authentication:** License key + machine fingerprint validation

---

### Real-Time Event Streaming (`/events/`)

**Purpose:** Server-Sent Events (SSE) for real-time desktop app notifications

**Routes:**

- `GET /api/events/[licenseKey]` - SSE stream for subscription events
- `GET /api/events/[licenseKey]/missed` - Fetch missed events
- `POST /api/events/acknowledge` - Acknowledge event processing
- `GET /api/events/acknowledge?eventId={id}` - Get acknowledgment status

**Pattern:** Redis pub/sub for event distribution across server instances

---

### Administrative Routes (`/admin/`)

**Purpose:** Administrative operations (admin-only)

**Routes:**

- `GET /api/admin/customers` - List all customers
- `GET /api/admin/stats` - System statistics
- `POST /api/admin/licenses/[licenseId]/revoke` - Revoke license
- `POST /api/admin/support/[ticketId]/respond` - Respond to support ticket

**Authentication:** Admin role required

---

### Analytics Routes (`/analytics/`)

**Purpose:** Usage analytics and reporting

**Routes:**

- `GET /api/analytics/health` - Health analytics
- `GET /api/analytics/patterns` - Usage patterns
- `GET /api/analytics/trends` - Usage trends

---

### Dead Letter Queue (`/dlq/`)

**Purpose:** Management of failed events that require manual intervention

**Routes:**

- `GET /api/dlq` - List DLQ items (with optional status filter)
- `GET /api/dlq?stats=true` - Get DLQ statistics
- `POST /api/dlq/retry/[eventId]` - Retry failed event
- `POST /api/dlq/resolve/[eventId]` - Mark event as resolved

**Use Case:** Events that failed processing after multiple retry attempts

---

### Scheduled Tasks (`/cron/`)

**Purpose:** Background jobs executed on a schedule (Vercel Cron)

**Routes:**

- `GET /api/cron/analytics` - Process analytics data
- `GET /api/cron/cleanup-events` - Clean up old events
- `GET /api/cron/detect-stale-sessions` - Detect stale SSE connections
- `GET /api/cron/expiration-check` - Check for expired subscriptions
- `POST /api/cron/expiration-check` - Manual expiration check trigger
- `GET /api/cron/health-monitoring` - System health monitoring
- `GET /api/cron/retry-events` - Retry failed events

**Pattern:** Cron job endpoints called by Vercel Cron scheduler

---

### Monitoring Routes (`/monitoring/`)

**Purpose:** System health and performance monitoring

**Routes:**

- `GET /api/monitoring/event-durability` - Event durability metrics
- `GET /api/monitoring/health` - System health status

---

### Terminal Management (`/terminals/`)

**Purpose:** Terminal device management

**Routes:**

- `GET /api/terminals` - Get all terminals for user
- `POST /api/terminals/broadcast` - Broadcast message to terminals
- `POST /api/terminals/sync` - Sync terminal data

---

### Other Routes

**Payments:**

- `GET /api/payments/history` - Payment history

**Invoices:**

- `GET /api/invoices/history` - Invoice history

**User Profile:**

- `GET /api/profile` - Get user profile
- `PUT /api/profile` - Update user profile

**User Information:**

- `GET /api/user` - Get user details

**Support:**

- `POST /api/support` - Submit support ticket

**Data Export:**

- `GET /api/data/export` - Export user data (GDPR compliance)

**Releases:**

- `GET /api/releases/latest` - Get latest release information

**Terminal Sessions:**

- `GET /api/terminal-sessions` - Get terminal session data

**Health Checks:**

- `GET /api/health/sse` - SSE health check

**Testing:**

- `GET /api/test/sse-status` - Test SSE connection status
- `POST /api/test/trigger-revoke` - Test license revocation trigger

---

## Architecture Patterns

### Dual Hybrid Approach

The API implements a dual hybrid architecture:

1. **Direct API Routes** (User-initiated, synchronous)

   - User actions trigger immediate Stripe API calls
   - Database updated immediately
   - Response returned to user (~250ms)
   - Examples: `/subscriptions/cancel`, `/subscriptions/change-plan`

2. **Webhook Routes** (Stripe-initiated, asynchronous)
   - Stripe events trigger webhook handler
   - Background processing (1-5 second delay acceptable)
   - Database updated asynchronously
   - Examples: `/stripe/webhooks/handler`

### Event Distribution Pattern

**Real-time sync via SSE:**

- Both webhook events and direct API actions publish to Redis
- SSE endpoint (`/events/[licenseKey]`) streams events to desktop apps
- Desktop apps acknowledge events via `/events/acknowledge`
- Failed events enter Dead Letter Queue for retry

### Security Layers

1. **Authentication:** NextAuth.js session validation
2. **Authorization:** Customer ownership validation via `requireAuth()` helper
3. **Webhook Verification:** Stripe signature validation
4. **Idempotency:** Webhook event deduplication via `webhookEvents` table

---

## HTTP Method Conventions

- **GET** - Read operations (queries)
- **POST** - Mutations, commands, and state changes
- **PUT** - Full resource updates
- **DELETE** - Resource deletion (rare, prefer soft deletes)

---

## Route Organization Principles

1. **Resource-based URLs** - Routes organized by resource (`/subscriptions/`, `/license/`)
2. **Action verbs for mutations** - Clear action names (`cancel`, `reactivate`, `change-plan`)
3. **Nouns for queries** - Resource names for reads (`current`, `history`, `plans`)
4. **Consistent depth** - Similar routes at same depth level
5. **Category grouping** - Related routes grouped together (Stripe routes in `/stripe/`)

---

## Database Schema Integration

The API routes interact with the following main database tables:

- `subscriptions` - Subscription records
- `customers` - Customer records
- `licenseKeys` - License key records
- `activations` - License activations per machine
- `payments` - Payment records
- `invoices` - Invoice records
- `subscriptionChanges` - Subscription change audit trail
- `webhookEvents` - Webhook deduplication
- `subscriptionEvents` - Events published to SSE
- `eventAcknowledgments` - Desktop app event acknowledgments
- `deadLetterQueue` - Failed events requiring manual intervention

---

## Error Handling

**Direct API Routes:**

- Errors caught and returned as user-friendly messages
- HTTP status codes: 400 (validation), 404 (not found), 500 (server error)
- Errors logged for debugging

**Webhook Routes:**

- Errors marked in `webhookEvents` table
- Return 500 status to trigger Stripe retry
- Failed events enter Dead Letter Queue after max retries

---

## Response Format

All API routes use consistent response helpers:

**Success Response:**

```typescript
{
  success: true,
  data: { ... }
}
```

**Error Response:**

```typescript
{
  success: false,
  error: "Error message",
  code?: "ERROR_CODE"
}
```

---

## Last Updated

**Date:** January 9, 2025  
**Version:** 2.0  
**Status:** Current documentation
