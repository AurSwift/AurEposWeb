# Subscription Management - Scenarios Documentation

This document explains how various subscription scenarios are handled in the application, including the files involved and production readiness.

## 📋 Table of Contents

- [Subscription Scenarios Overview](#subscription-scenarios-overview)
- [Scenario 1: New Subscription Creation](#scenario-1-new-subscription-creation)
- [Scenario 2: Subscription Cancellation](#scenario-2-subscription-cancellation)
- [Scenario 3: Subscription Reactivation](#scenario-3-subscription-reactivation)
- [Scenario 4: Plan Change (Upgrade/Downgrade)](#scenario-4-plan-change-upgradedowngrade)
- [Scenario 5: Payment Success](#scenario-5-payment-success)
- [Scenario 6: Payment Failure](#scenario-6-payment-failure)
- [Scenario 7: Subscription Status Updates](#scenario-7-subscription-status-updates)
- [Scenario 8: Viewing Current Subscription](#scenario-8-viewing-current-subscription)
- [Scenario 9: Subscription History](#scenario-9-subscription-history)
- [Scenario 10: Billing Portal Access](#scenario-10-billing-portal-access)
- [Database Schema](#database-schema)
- [Production Readiness](#production-readiness)

---

## Subscription Scenarios Overview

The subscription system integrates with Stripe for payment processing and handles various lifecycle events through webhooks and API endpoints. All subscription operations are tracked in the database with audit trails.

---

## Scenario 1: New Subscription Creation

### Description

When a new user signs up and completes payment, a subscription is created with a license key generated automatically.

### Flow

1. User signs up via signup page
2. User selects a plan and billing cycle
3. Stripe Checkout session is created
4. After payment, webhook creates subscription record
5. License key is generated and stored

### Files Involved

#### Frontend/UI Components

- **`web/app/signup/page.tsx`** - Multi-step signup flow (Account → Plan → Billing)
- **`web/components/pricing/plan-card.tsx`** - Plan display card component
- **`web/components/pricing/billing-toggle.tsx`** - Monthly/Annual toggle component
- **`web/app/success/page.tsx`** - Post-payment success page showing license key

#### API Routes

- **`web/app/api/stripe/create-checkout/route.ts`** - Creates Stripe Checkout session

  - Creates or retrieves Stripe customer
  - Sets up trial periods (7 days monthly, 14 days annual)
  - Returns checkout URL

- **`web/app/api/stripe/webhook/route.ts`** - Handles Stripe webhooks
  - **Event: `checkout.session.completed`** - Creates subscription record
  - Generates license key via `generateLicenseKey()`
  - Stores subscription in database
  - Creates initial payment record if invoice is already paid

#### Library Files

- **`web/lib/stripe/client.ts`** - Stripe client initialization
- **`web/lib/stripe/plans.ts`** - Plan definitions and pricing logic
  - Fetches plans from Stripe or environment variables
  - Provides plan features and limits
- **`web/lib/license/generator.ts`** - License key generation
  - Format: `AUR-{PlanCode}-V{Version}-{Random8Char}-{Checksum}`
  - Stores license key in database

#### Database Tables

- `subscriptions` - Main subscription record
- `licenseKeys` - Generated license key
- `payments` - Payment record
- `subscriptionChanges` - Audit trail entry
- `webhookEvents` - Idempotency tracking

### Production Ready

✅ **Yes** - Fully production ready with:

- Webhook signature verification
- Idempotency checks
- Error handling
- License key generation
- Trial period support (7 days monthly, 14 days annual)

---

## Scenario 2: Subscription Cancellation

### Description

Users can cancel subscriptions either immediately or at the end of the billing period. Immediate cancellation revokes license keys.

### Flow

1. User clicks "Cancel Subscription" in dashboard
2. User selects cancellation type (end of period or immediately)
3. API cancels in Stripe and updates database
4. If immediate, license keys are revoked

### Files Involved

#### Frontend/UI Components

- **`web/components/dashboard/subscription-actions.tsx`** - Cancel subscription UI
  - Shows cancellation dialog with options
  - Collects cancellation reason (optional)

#### API Routes

- **`web/app/api/subscriptions/cancel/route.ts`** - Handles cancellation
  - Cancels in Stripe (immediate or at period end)
  - Updates subscription status in database
  - Revokes license keys if immediate cancellation
  - Records cancellation in `subscriptionChanges` table

#### Database Tables

- `subscriptions` - Status updated (`cancelAtPeriodEnd`, `canceledAt`, `status`)
- `licenseKeys` - Set to inactive if immediate cancellation
- `subscriptionChanges` - Audit trail entry

### Production Ready

✅ **Yes** - Fully production ready with:

- Two cancellation modes (immediate vs. end of period)
- License key revocation for immediate cancellations
- Audit trail recording
- Proper status updates

---

## Scenario 3: Subscription Reactivation

### Description

Users can reactivate a subscription that was scheduled for cancellation (if not yet canceled).

### Flow

1. User clicks "Reactivate Subscription" (shown when `cancelAtPeriodEnd` is true)
2. API removes cancellation flag in Stripe
3. Database is updated to remove cancellation

### Files Involved

#### Frontend/UI Components

- **`web/components/dashboard/subscription-actions.tsx`** - Reactivate button shown when subscription is scheduled for cancellation

#### API Routes

- **`web/app/api/subscriptions/reactivate/route.ts`** - Handles reactivation
  - Checks if subscription is eligible (must have `cancelAtPeriodEnd` set)
  - Removes cancellation flag in Stripe
  - Updates database to set `cancelAtPeriodEnd: false`
  - Records reactivation in audit trail

#### Database Tables

- `subscriptions` - `cancelAtPeriodEnd` set to false, status set to active
- `subscriptionChanges` - Audit trail entry

### Production Ready

✅ **Yes** - Fully production ready with:

- Validation to prevent reactivating already-canceled subscriptions
- Proper Stripe sync
- Audit trail

---

## Scenario 4: Plan Change (Upgrade/Downgrade)

### Description

Users can change their subscription plan or billing cycle. Changes take effect immediately with proration handled by Stripe.

### Flow

1. User selects new plan/billing cycle from dialog
2. API calculates price difference
3. Stripe subscription is updated with new price
4. Database is updated with new plan details
5. License key terminal limits are updated

### Files Involved

#### Frontend/UI Components

- **`web/components/dashboard/subscription-actions.tsx`** - Change plan dialog
  - Shows plan selection dropdown
  - Shows billing cycle toggle (monthly/annual)
  - Displays price comparison
  - Shows proration notice

#### API Routes

- **`web/app/api/subscriptions/change-plan/route.ts`** - Handles plan changes
  - Validates new plan ID
  - Updates Stripe subscription with new price ID
  - Uses Stripe proration (`proration_behavior: "create_prorations"`)
  - Updates subscription record in database
  - Updates license key `maxTerminals` based on new plan
  - Records change in audit trail

#### Library Files

- **`web/lib/stripe/plans.ts`** - Provides plan details and price IDs
- **`web/lib/db/payment-helpers.ts`** - Handles proration payment records (if applicable)

#### Database Tables

- `subscriptions` - Plan ID, billing cycle, and price updated
- `licenseKeys` - `maxTerminals` updated to match new plan features
- `subscriptionChanges` - Audit trail entry with previous/new plan details
- `payments` - Proration payment record (if applicable)

### Production Ready

✅ **Yes** - Fully production ready with:

- Immediate plan changes
- Automatic proration by Stripe
- License key limits updated automatically
- Complete audit trail

---

## Scenario 5: Payment Success

### Description

When a subscription payment succeeds (recurring or initial), the subscription status is updated and payment record is created.

### Flow

1. Stripe processes payment successfully
2. Webhook receives `invoice.payment_succeeded` event
3. Subscription status updated to "active"
4. Payment record created in database

### Files Involved

#### API Routes

- **`web/app/api/stripe/webhook/route.ts`** - Handles webhooks
  - **Event: `invoice.payment_succeeded`** - Processes successful payment
  - Updates subscription status to "active"
  - Creates payment record via `createPaymentFromInvoice()`

#### Library Files

- **`web/lib/db/payment-helpers.ts`** - Creates payment records with idempotency checks

#### Database Tables

- `subscriptions` - Status updated to "active"
- `payments` - New payment record created
- `webhookEvents` - Event logged for idempotency

### Production Ready

✅ **Yes** - Fully production ready with:

- Idempotency checks to prevent duplicate payments
- Proper status updates
- Payment record creation

---

## Scenario 6: Payment Failure

### Description

When a subscription payment fails, the subscription status is updated to "past_due" and a failed payment record is created.

### Flow

1. Stripe payment attempt fails
2. Webhook receives `invoice.payment_failed` event
3. Subscription status updated to "past_due"
4. Failed payment record created

### Files Involved

#### API Routes

- **`web/app/api/stripe/webhook/route.ts`** - Handles webhooks
  - **Event: `invoice.payment_failed`** - Processes failed payment
  - Updates subscription status to "past_due"
  - Creates failed payment record
  - Records status change in audit trail

#### Library Files

- **`web/lib/db/payment-helpers.ts`** - Creates payment records with status "failed"

#### Database Tables

- `subscriptions` - Status updated to "past_due"
- `payments` - Failed payment record created
- `subscriptionChanges` - Status change logged
- `webhookEvents` - Event logged for idempotency

### Production Ready

✅ **Yes** - Fully production ready with:

- Proper status handling
- Failed payment tracking
- Audit trail

---

## Scenario 7: Subscription Status Updates

### Description

Stripe webhooks update subscription status when it changes (trial ending, cancellation, etc.).

### Flow

1. Stripe subscription status changes
2. Webhook receives `customer.subscription.updated` or `customer.subscription.deleted`
3. Database subscription record is synced with Stripe

### Files Involved

#### API Routes

- **`web/app/api/stripe/webhook/route.ts`** - Handles webhooks
  - **Event: `customer.subscription.updated`** - Syncs subscription status
  - **Event: `customer.subscription.deleted`** - Marks subscription as cancelled and revokes license keys
  - Updates all subscription fields (status, periods, cancellation flags)
  - Records status changes in audit trail

#### Database Tables

- `subscriptions` - Status and dates updated
- `licenseKeys` - Revoked if subscription deleted
- `subscriptionChanges` - Status change logged (if status changed)

### Production Ready

✅ **Yes** - Fully production ready with:

- Complete status synchronization
- License key revocation on deletion
- Audit trail for status changes

---

## Scenario 8: Viewing Current Subscription

### Description

Users can view their current subscription details including plan, status, billing dates, and license keys.

### Flow

1. User navigates to dashboard/subscription page
2. Component fetches current subscription from API
3. Subscription details are displayed with license keys

### Files Involved

#### Frontend/UI Components

- **`web/components/subscription-card.tsx`** - Subscription summary card
  - Shows plan name, status, next billing date
  - Displays trial period warnings
  - Shows cancellation notices
- **`web/components/dashboard/subscription-details.tsx`** - Detailed subscription view
  - Full subscription information
  - License keys list with copy functionality
  - Billing information
  - Trial period warnings
  - Cancellation warnings

#### API Routes

- **`web/app/api/subscriptions/current/route.ts`** - Fetches current active subscription
  - Gets customer from session
  - Queries for active or trialing subscriptions
  - Includes associated license keys
  - Returns null if no active subscription

#### Database Tables

- `subscriptions` - Queried for active/trialing subscriptions
- `licenseKeys` - Joined to get active license keys

### Production Ready

✅ **Yes** - Fully production ready with:

- Proper authentication checks
- Active subscription filtering
- License key association

---

## Scenario 9: Subscription History

### Description

Users can view their subscription change history (upgrades, downgrades, cancellations, etc.).

### Flow

1. User views subscription history page
2. API fetches subscription changes with pagination
3. Change history is displayed

### Files Involved

#### API Routes

- **`web/app/api/subscriptions/history/route.ts`** - Fetches subscription change history
  - Supports pagination (page, limit)
  - Returns subscription changes ordered by date
  - Includes change type, previous/new values, effective dates

#### Database Tables

- `subscriptionChanges` - Queried for customer's change history

### Production Ready

✅ **Yes** - Fully production ready with:

- Pagination support
- Complete audit trail
- Historical change tracking

---

## Scenario 10: Billing Portal Access

### Description

Users can access Stripe's customer portal to manage payment methods, view invoices, and update billing information.

### Flow

1. User clicks "Manage Billing" button
2. API creates Stripe billing portal session
3. User is redirected to Stripe-hosted portal
4. After completing actions, user is redirected back to dashboard

### Files Involved

#### Frontend/UI Components

- **`web/components/dashboard/subscription-details.tsx`** - "Manage Billing" button
  - Calls API to create portal session
  - Redirects user to portal URL

#### API Routes

- **`web/app/api/stripe/portal/route.ts`** - Creates Stripe billing portal session
  - Gets customer's Stripe customer ID
  - Creates portal session with return URL
  - Returns portal URL for redirect

### Production Ready

✅ **Yes** - Fully production ready with:

- Secure portal access
- Proper return URL configuration
- Customer authentication

---

## Additional Files

### Manual Sync (Development Only)

- **`web/app/api/stripe/sync-subscription/route.ts`** - Manually syncs subscription from Stripe checkout session
  - **Purpose**: For local development when webhooks don't work
  - **Production**: Not needed (webhooks handle this automatically)
  - Used to manually create subscription record from checkout session ID

### Plan Management

- **`web/app/api/plans/route.ts`** - Returns available plans
  - Fetches plans from Stripe via `getPlans()`
  - Returns plan details for frontend display

---

## Database Schema

### Key Tables

#### `subscriptions`

- Stores subscription records with plan, billing cycle, status, dates
- Links to Stripe via `stripeSubscriptionId` and `stripeCustomerId`
- Location: **`web/lib/db/schema.ts`** (lines 35-76)

#### `customers`

- Links users to subscriptions
- Stores Stripe customer ID
- Location: **`web/lib/db/schema.ts`** (lines 17-33)

#### `licenseKeys`

- Stores generated license keys
- Links to subscriptions and customers
- Includes terminal limits and activation counts
- Location: **`web/lib/db/schema.ts`** (lines 78-100)

#### `subscriptionChanges`

- Audit trail for all subscription changes
- Tracks previous/new values for plan changes
- Location: **`web/lib/db/schema.ts`** (lines 155-197)

#### `payments`

- Payment records linked to subscriptions
- Tracks payment status, amounts, billing periods
- Location: **`web/lib/db/schema.ts`** (lines 119-153)

#### `webhookEvents`

- Idempotency tracking for Stripe webhooks
- Prevents duplicate webhook processing
- Location: **`web/lib/db/schema.ts`** (lines 199-217)

---

## Production Readiness

### ✅ All Scenarios Are Production Ready

All subscription scenarios are fully implemented and production-ready with:

1. **Security**

   - Webhook signature verification
   - Authentication required for all API endpoints
   - Idempotency checks for webhooks

2. **Error Handling**

   - Try-catch blocks in all API routes
   - Proper error responses
   - Console logging for debugging

3. **Data Integrity**

   - Database transactions where needed
   - Audit trails for all changes
   - Proper foreign key relationships

4. **Stripe Integration**

   - Proper webhook event handling
   - Subscription status synchronization
   - Proration handling for plan changes

5. **User Experience**
   - Clear UI feedback
   - Loading states
   - Error messages
   - Success confirmations

### Environment Variables Required

For production, ensure these environment variables are set:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (from Stripe Dashboard)
STRIPE_PRICE_ID_BASIC_MONTHLY=price_...
STRIPE_PRICE_ID_BASIC_ANNUAL=price_...
STRIPE_PRICE_ID_PRO_MONTHLY=price_...
STRIPE_PRICE_ID_PRO_ANNUAL=price_...
STRIPE_PRICE_ID_ENTERPRISE_MONTHLY=price_...
STRIPE_PRICE_ID_ENTERPRISE_ANNUAL=price_...
```

### Webhook Configuration

In production, configure Stripe webhooks to send events to:

```
https://yourdomain.com/api/stripe/webhook
```

Required events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

### No Additional Code Required

All subscription scenarios work in production **without writing any extra code**. The implementation is complete and handles:

- ✅ Subscription creation with license keys
- ✅ Cancellation (immediate and end of period)
- ✅ Reactivation
- ✅ Plan changes with proration
- ✅ Payment success/failure handling
- ✅ Status synchronization via webhooks
- ✅ Subscription viewing
- ✅ History tracking
- ✅ Billing portal access

Simply configure the environment variables and webhooks, and the system is ready for production use.
