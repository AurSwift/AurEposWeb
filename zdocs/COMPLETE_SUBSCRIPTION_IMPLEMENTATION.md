# Complete Subscription Flow Implementation Plan
## Customer Registration → Plan Selection → Billing Cycle → Stripe → Dashboard

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Database Schema Updates](#database-schema-updates)
4. [Stripe Setup](#stripe-setup)
5. [Implementation Phases](#implementation-phases)
6. [File-by-File Implementation](#file-by-file-implementation)
7. [Testing Checklist](#testing-checklist)

---

## 🎯 Overview

This plan implements a complete subscription flow where:
1. Customer registers account
2. Selects plan (Basic/Professional)
3. Chooses billing cycle (Monthly/Annual with 20% discount)
4. Redirects to Stripe Checkout
5. Stripe processes payment
6. Webhook creates subscription + generates license key
7. Customer redirected to dashboard with license key

**Business Rules Applied:**
- License key format: `EPOS-{Plan}-V2-{Random}-{Checksum}`
- Trial periods: 7 days (monthly), 14 days (annual)
- Annual discount: 20%
- Auto-renewal enabled by default
- License key generated on successful payment

---

## 🔧 Prerequisites

### 1. Stripe Account Setup

1. Create Stripe account: https://stripe.com
2. Get API keys (test mode for development)
3. Create Products & Prices in Stripe Dashboard:
   - Product: "Basic Plan"
     - Price: $49/month (recurring)
     - Price: $470/year (recurring, 20% discount)
   - Product: "Professional Plan"
     - Price: $99/month (recurring)
     - Price: $950/year (recurring, 20% discount)
4. Copy Price IDs to environment variables

### 2. Environment Variables

Add to `.env.local`:
```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (from Stripe Dashboard)
STRIPE_PRICE_ID_BASIC_MONTHLY=price_...
STRIPE_PRICE_ID_BASIC_ANNUAL=price_...
STRIPE_PRICE_ID_PRO_MONTHLY=price_...
STRIPE_PRICE_ID_PRO_ANNUAL=price_...
```

### 3. Install Dependencies

```bash
pnpm add stripe @stripe/stripe-js
```

---

## 🗄️ Database Schema Updates

### Update 1: Add Stripe Fields to Customers

**File:** `lib/db/schema.ts`

```typescript
export const customers = pgTable("customers", {
  // ... existing fields
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
});
```

### Update 2: Add Stripe Fields to Subscriptions

**File:** `lib/db/schema.ts`

```typescript
export const subscriptions = pgTable("subscriptions", {
  // ... existing fields
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
});
```

**Migration:**
```bash
pnpm db:generate
pnpm db:push
```

---

## 📁 Complete File Structure

```
web/
├── lib/
│   ├── stripe/
│   │   ├── client.ts              # Stripe client initialization
│   │   └── plans.ts               # Plan definitions & pricing
│   └── license/
│       └── generator.ts            # License key generation
│
├── app/
│   ├── pricing/
│   │   └── page.tsx                # Pricing page (optional)
│   ├── signup/
│   │   └── page.tsx                # Multi-step signup form
│   ├── success/
│   │   └── page.tsx                # Post-payment success page
│   └── api/
│       └── stripe/
│           ├── create-checkout/
│           │   └── route.ts       # Create Stripe Checkout session
│           └── webhook/
│               └── route.ts       # Handle Stripe webhooks
│
└── components/
    └── pricing/
        ├── plan-card.tsx           # Plan display card
        └── billing-toggle.tsx     # Monthly/Annual toggle
```

---

## 🚀 Implementation Phases

### Phase 1: Foundation (Setup)
1. Install Stripe packages
2. Update database schema
3. Create Stripe client
4. Create plan configuration

### Phase 2: Core Logic
5. Create license key generator
6. Create checkout session API
7. Create webhook handler

### Phase 3: UI Components
8. Update signup page (multi-step)
9. Create plan selection UI
10. Create billing cycle toggle
11. Create success page

### Phase 4: Integration
12. Connect signup → checkout
13. Test webhook handling
14. Verify license key generation
15. Test complete flow

---

## 📝 File-by-File Implementation

### File 1: Stripe Client

**Path:** `lib/stripe/client.ts`

```typescript
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
});
```

---

### File 2: Plan Configuration

**Path:** `lib/stripe/plans.ts`

[See full implementation in SUBSCRIPTION_FLOW_DETAILED_PLAN.md]

---

### File 3: License Key Generator

**Path:** `lib/license/generator.ts`

[See full implementation in SUBSCRIPTION_FLOW_DETAILED_PLAN.md]

---

### File 4: Checkout API Route

**Path:** `app/api/stripe/create-checkout/route.ts`

[See full implementation in SUBSCRIPTION_FLOW_DETAILED_PLAN.md]

---

### File 5: Webhook Handler

**Path:** `app/api/stripe/webhook/route.ts`

[See full implementation in SUBSCRIPTION_FLOW_DETAILED_PLAN.md]

---

### File 6: Updated Signup Page

**Path:** `app/signup/page.tsx`

**Multi-step flow:**
1. Step 1: Account creation (existing)
2. Step 2: Plan selection (new)
3. Step 3: Billing cycle selection (new)
4. Step 4: Redirect to Stripe Checkout

---

### File 7: Success Page

**Path:** `app/success/page.tsx`

Displays:
- Welcome message
- License key (with copy button)
- Download link
- Activation instructions
- Link to dashboard

---

## ✅ Implementation Checklist

### Setup Phase
- [ ] Install Stripe packages
- [ ] Add Stripe environment variables
- [ ] Create Stripe products & prices
- [ ] Update database schema (add Stripe fields)
- [ ] Run migrations

### Core Implementation
- [ ] Create `lib/stripe/client.ts`
- [ ] Create `lib/stripe/plans.ts`
- [ ] Create `lib/license/generator.ts`
- [ ] Create `app/api/stripe/create-checkout/route.ts`
- [ ] Create `app/api/stripe/webhook/route.ts`

### UI Implementation
- [ ] Update `app/signup/page.tsx` (multi-step)
- [ ] Create `components/pricing/plan-card.tsx`
- [ ] Create `components/pricing/billing-toggle.tsx`
- [ ] Create `app/success/page.tsx`

### Testing
- [ ] Test account creation
- [ ] Test plan selection
- [ ] Test Stripe Checkout redirect
- [ ] Test webhook handling
- [ ] Test license key generation
- [ ] Test dashboard display

---

## 🔍 Detailed Flow Diagram

```
User Action                    Server Action                    Database
─────────────────────────────────────────────────────────────────────────
1. Fill signup form
   ↓
2. Submit form              POST /api/auth/signup
   ↓                         - Create user
   ↓                         - Create customer
   ↓                         - Link user ↔ customer
   ↓                         
3. Auto sign-in              NextAuth signIn
   ↓
4. Select plan               (Client-side)
   ↓
5. Select billing cycle      (Client-side)
   ↓
6. Click "Proceed"           POST /api/stripe/create-checkout
   ↓                         - Get/create Stripe customer
   ↓                         - Create checkout session
   ↓                         - Return checkout URL
   ↓
7. Redirect to Stripe        (External - Stripe hosted)
   ↓
8. Enter payment details     (External - Stripe processes)
   ↓
9. Payment succeeds          Stripe Webhook → POST /api/stripe/webhook
   ↓                         - Verify webhook signature
   ↓                         - Handle checkout.session.completed
   ↓                         - Create subscription record
   ↓                         - Generate license key
   ↓                         - Store license key
   ↓                         - Create payment record
   ↓
10. Redirect to /success     GET /success
    ↓                        - Fetch subscription
    ↓                        - Fetch license key
    ↓                        - Display to user
    ↓
11. View dashboard           GET /dashboard
    ↓                        - Show subscription info
    ↓                        - Show license key
```

---

## 🎨 UI/UX Flow Details

### Step 1: Account Creation
```
┌─────────────────────────────────────┐
│  Sign Up                            │
├─────────────────────────────────────┤
│  Company Name: [________]           │
│  Email: [________]                  │
│  Password: [________]               │
│  ☐ I agree to Terms                 │
│                                     │
│  [Start Free Trial]                 │
└─────────────────────────────────────┘
```

### Step 2: Plan Selection
```
┌─────────────────────────────────────┐
│  Choose Your Plan                    │
├─────────────────────────────────────┤
│  [Basic]    [Professional★]
│  $49/mo     $99/mo        $299/mo  │
│                                     │
│  Features:                          │
│  • Up to 3 terminals                │
│  • Basic inventory                  │
│                                     │
│  [Continue]                          │
└─────────────────────────────────────┘
```

### Step 3: Billing Cycle
```
┌─────────────────────────────────────┐
│  Select Billing Cycle               │
├─────────────────────────────────────┤
│  Selected: Professional             │
│                                     │
│  ○ Monthly  $99/month              │
│  ● Annual   $950/year               │
│     Save $238 per year!             │
│                                     │
│  [Proceed to Payment]               │
└─────────────────────────────────────┘
```

### Step 4: Stripe Checkout
```
┌─────────────────────────────────────┐
│  Stripe Checkout (External)         │
├─────────────────────────────────────┤
│  Card Number: [________]            │
│  Expiry: [MM/YY]                    │
│  CVC: [___]                         │
│                                     │
│  [Pay $950.00]                      │
└─────────────────────────────────────┘
```

### Step 5: Success Page
```
┌─────────────────────────────────────┐
│  Welcome to aurswift! ✅            │
├─────────────────────────────────────┤
│  Your License Key:                  │
│  EPOS-PRO-V2-7A83B2D4-E9            │
│  [Copy]                             │
│                                     │
│  [Download EPOS Software]            │
│                                     │
│  Activation Instructions:           │
│  1. Download and install software   │
│  2. Enter license key when prompted │
│  3. Start using EPOS!               │
│                                     │
│  [Go to Dashboard]                  │
└─────────────────────────────────────┘
```

---

## 🔐 Security Checklist

- [ ] Webhook signature verification
- [ ] Server-side only Stripe secret key
- [ ] Idempotency for webhook events
- [ ] Rate limiting on checkout endpoint
- [ ] Input validation on all forms
- [ ] SQL injection prevention (Drizzle handles this)
- [ ] XSS prevention (React handles this)

---

## 📊 Error Handling

### Checkout Errors
- Invalid plan ID → 400 Bad Request
- Missing customer → 404 Not Found
- Stripe API error → 500 Internal Server Error

### Webhook Errors
- Invalid signature → 400 Bad Request
- Missing metadata → Log and skip
- Database error → Log and retry

### User-Facing Errors
- Display clear error messages
- Provide retry options
- Log errors for debugging

---

## 🧪 Testing Strategy

### Unit Tests
- License key generation
- Plan price calculations
- Checksum validation

### Integration Tests
- Checkout session creation
- Webhook event handling
- Database record creation

### E2E Tests
- Complete signup flow
- Stripe Checkout redirect
- Success page display
- Dashboard access

---

## 📈 Monitoring & Analytics

### Key Metrics to Track
1. Signup conversion rate
2. Plan selection distribution
3. Billing cycle preference (monthly vs annual)
4. Checkout completion rate
5. License key activation rate
6. Payment success/failure rates

### Logging
- All subscription events
- Webhook processing
- License key generation
- Error occurrences

---

## 🚀 Deployment Steps

1. **Stripe Production Setup**
   - Switch to live API keys
   - Create production products/prices
   - Configure production webhook endpoint

2. **Environment Variables**
   - Add all Stripe keys to production
   - Verify webhook secret

3. **Database Migration**
   - Run migrations in production
   - Verify schema updates

4. **Testing**
   - Test with real Stripe test mode
   - Verify webhook delivery
   - Test complete flow

---

## 📚 Additional Resources

- [Stripe Subscriptions Docs](https://stripe.com/docs/billing/subscriptions/overview)
- [Stripe Checkout Docs](https://stripe.com/docs/payments/checkout)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)

---

## 🔄 Subscription Upgrade & Downgrade Scenarios

### Overview

Aurswift handles subscription changes with **automatic proration** following Stripe best practices. When customers upgrade or downgrade their plans, the system calculates the difference in cost for the remaining billing period and either charges the customer immediately (upgrade) or applies a credit to the next invoice (downgrade).

---

### Scenario 1: Upgrade (Plan A → Plan B on Jan 4)

**Timeline:**
- **Jan 2, 2026**: Customer purchases Plan A (Basic - $49/month)
- **Jan 4, 2026**: Customer upgrades to Plan B (Professional - $99/month)

**What Happens:**

1. **Initial Purchase (Jan 2)**
   - Customer subscribes to Basic plan at $49/month
   - Billing period: Jan 2 - Feb 2 (31 days)
   - Full $49 charge on Jan 2
   - Status: `active` or `trialing` (if 7-day trial)

2. **Upgrade Request (Jan 4)**
   - Customer clicks "Upgrade to Professional" in dashboard
   - System calls `/api/subscriptions/preview-change` to show proration
   - Preview shows:
     ```
     Current Plan: Basic ($49/month)
     New Plan: Professional ($99/month)
     
     Proration Charge: $46.45
     Calculation:
     - Days remaining: 29 days (Jan 4 - Feb 2)
     - Unused Basic credit: (29/31) × $49 = $45.81
     - Professional charge for 29 days: (29/31) × $99 = $92.26
     - Immediate charge: $92.26 - $45.81 = $46.45
     
     Next billing: Feb 2, 2026 for $99.00
     ```

3. **Upgrade Execution**
   - API endpoint: `POST /api/subscriptions/change-plan`
   - Request body:
     ```json
     {
       "subscriptionId": "sub_abc123",
       "newPlanId": "professional",
       "newBillingCycle": "monthly"
     }
     ```

4. **Stripe Processing**
   - Stripe updates subscription with `proration_behavior: "create_prorations"`
   - Creates immediate invoice for $46.45
   - Charges customer's payment method
   - Updates subscription to Professional plan

5. **Database Updates (Transaction)**
   ```sql
   -- Update subscription record
   UPDATE subscriptions SET
     plan_id = 'professional',
     price = '99.00',
     updated_at = NOW()
   WHERE id = 'sub_abc123';
   
   -- Record change in audit trail
   INSERT INTO subscription_changes (
     subscription_id,
     customer_id,
     change_type,
     previous_plan_id,
     new_plan_id,
     previous_price,
     new_price,
     proration_amount,
     effective_date,
     reason
   ) VALUES (
     'sub_abc123',
     'cust_xyz789',
     'plan_upgrade',
     'basic',
     'professional',
     '49.00',
     '99.00',
     '46.45',
     '2026-01-04',
     'Plan changed from basic to professional'
   );
   
   -- Update license key terminal limits
   UPDATE license_keys SET
     max_terminals = 5
   WHERE subscription_id = 'sub_abc123';
   ```

6. **Desktop App Notification**
   - SSE (Server-Sent Event) broadcast to desktop apps
   - Desktop app shows: "Subscription upgraded! You can now activate up to 5 terminals."

7. **Email Notification**
   - Customer receives upgrade confirmation email
   - Invoice for $46.45 proration charge attached

**Result:**
- ✅ Customer immediately gets Professional plan benefits
- ✅ License key now allows 5 terminals (was 1)
- ✅ Charged $46.45 for remaining 29 days
- ✅ Next billing: Feb 2 for $99.00

---

### Scenario 2: Downgrade (Plan C → Plan B on Jan 6)

**Timeline:**
- **Jan 3, 2026**: Customer purchases Plan C (Enterprise - $299/month)
- **Jan 6, 2026**: Customer downgrades to Plan B (Professional - $99/month)

**What Happens:**

1. **Initial Purchase (Jan 3)**
   - Customer subscribes to Enterprise plan at $299/month
   - Billing period: Jan 3 - Feb 3 (31 days)
   - Full $299 charge on Jan 3
   - Status: `active` or `trialing` (if 7-day trial)

2. **Downgrade Request (Jan 6)**
   - Customer clicks "Change Plan" → selects Professional
   - System calls `/api/subscriptions/preview-change` to show impact
   - Preview shows:
     ```
     Current Plan: Enterprise ($299/month)
     New Plan: Professional ($99/month)
     
     Credit Applied: $193.55
     Calculation:
     - Days remaining: 28 days (Jan 6 - Feb 3)
     - Unused Enterprise credit: (28/31) × $299 = $269.68
     - Professional charge for 28 days: (28/31) × $99 = $89.42
     - Credit to next invoice: $269.68 - $89.42 = $180.26
     
     Effective immediately
     Next billing: Feb 3, 2026 for $99.00 (minus $180.26 credit)
     ```

3. **Downgrade Execution**
   - API endpoint: `POST /api/subscriptions/change-plan`
   - Request body:
     ```json
     {
       "subscriptionId": "sub_def456",
       "newPlanId": "professional",
       "newBillingCycle": "monthly"
     }
     ```

4. **Stripe Processing**
   - Stripe updates subscription with `proration_behavior: "create_prorations"`
   - Creates credit of $180.26 for unused Enterprise time
   - Credit applied to next invoice (Feb 3)
   - Immediately switches to Professional plan

5. **Database Updates (Transaction)**
   ```sql
   -- Update subscription record
   UPDATE subscriptions SET
     plan_id = 'professional',
     price = '99.00',
     updated_at = NOW()
   WHERE id = 'sub_def456';
   
   -- Record change in audit trail
   INSERT INTO subscription_changes (
     subscription_id,
     customer_id,
     change_type,
     previous_plan_id,
     new_plan_id,
     previous_price,
     new_price,
     proration_amount,
     effective_date,
     reason
   ) VALUES (
     'sub_def456',
     'cust_uvw456',
     'plan_upgrade',
     'basic',
     'professional',
     '49.00',
     '99.00',
     '42.10',  -- Positive = charge
     '2026-01-06',
     'Plan changed from basic to professional'
   );
   
   -- Update license key terminal limits
   UPDATE license_keys SET
     max_terminals = 5  -- Was 1, now 5
   WHERE subscription_id = 'sub_def456';
   ```

6. **Desktop App Notification**
   - SSE broadcast to desktop apps
   - Desktop app shows: "Plan changed to Professional. Terminal limit: 5"
   - If customer has > 5 active terminals, shows warning to deactivate extras

7. **Email Notification**
   - Customer receives downgrade confirmation email
   - Shows $180.26 credit will be applied to next invoice

**Result:**
- ✅ Customer immediately switched to Professional plan
- ✅ License key now limits to 5 terminals (was unlimited)
- ✅ $180.26 credit applied to account
- ✅ Next billing: Feb 3 for $99.00, but only charged $0 (credit > invoice)
- ✅ Remaining credit ($81.26) rolls to following month

---

### Best Practices Implemented

| Practice | Implementation | Benefit |
|----------|----------------|---------|
| **Immediate Upgrades** | ✅ Applied instantly with proration charge | Better UX, instant access to features |
| **Downgrade Credits** | ✅ Credit applied to next invoice | Fair billing, no immediate charge |
| **Proration Calculation** | ✅ Automatic via Stripe | Accurate, no manual calculations |
| **Preview Before Change** | ✅ `/api/subscriptions/preview-change` endpoint | Transparency, informed decisions |
| **Audit Trail** | ✅ `subscription_changes` table | Compliance, support debugging |
| **License Limit Updates** | ✅ Immediate terminal limit changes | Prevent over-usage, enforce tiers |
| **SSE Notifications** | ✅ Real-time desktop app updates | Seamless desktop integration |
| **Email Confirmations** | ✅ Automated notifications | Customer awareness, records |

---

### API Endpoints Reference

#### 1. Preview Subscription Change
```typescript
POST /api/subscriptions/preview-change
Request: {
  subscriptionId: string,
  newPlanId: "basic" | "professional",
  newBillingCycle?: "monthly" | "annual"
}

Response: {
  preview: {
    changeType: "upgrade" | "downgrade",
    currentPlan: { id, name, price, billingCycle },
    newPlan: { id, name, price, billingCycle, maxTerminals },
    proration: {
      amount: number,
      immediateCharge: number,
      creditApplied: number,
      currency: string,
      description: string
    },
    nextBilling: { date, amount, currency },
    effectiveDate: Date
  }
}
```

#### 2. Execute Plan Change
```typescript
POST /api/subscriptions/change-plan
Request: {
  subscriptionId: string,
  newPlanId: "basic" | "professional",
  newBillingCycle?: "monthly" | "annual"
}

Response: {
  success: true,
  message: string,
  subscription: {
    planId: string,
    billingCycle: string,
    price: number,
    prorationAmount: number
  }
}
```

---

### UI Components

#### Subscription History Display
New component: `components/dashboard/subscription-history-card.tsx`

Shows all past plan changes with:
- Change type badge (Upgrade/Downgrade/Cancelled)
- Date of change
- Previous plan → New plan
- Proration amount (charged or credited)
- Change reason

**Usage:**
```tsx
import { SubscriptionHistoryCard } from "@/components/dashboard/subscription-history-card";

// Fetch subscription changes
const changes = await db.select()
  .from(subscriptionChanges)
  .where(eq(subscriptionChanges.customerId, customerId))
  .orderBy(desc(subscriptionChanges.effectiveDate));

<SubscriptionHistoryCard changes={changes} />
```

---

### Testing the Scenarios

#### Test Scenario 1 (Upgrade)
```bash
# 1. Create subscription on Jan 2
curl -X POST http://localhost:3000/api/stripe/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "basic",
    "billingCycle": "monthly"
  }'

# 2. Complete Stripe checkout

# 3. Wait for webhook (or use Stripe CLI)
stripe trigger checkout.session.completed

# 4. Preview upgrade on Jan 4
curl -X POST http://localhost:3000/api/subscriptions/preview-change \
  -H "Content-Type: application/json" \
  -d '{
    "subscriptionId": "sub_abc123",
    "newPlanId": "professional"
  }'

# 5. Execute upgrade
curl -X POST http://localhost:3000/api/subscriptions/change-plan \
  -H "Content-Type: application/json" \
  -d '{
    "subscriptionId": "sub_abc123",
    "newPlanId": "professional"
  }'
```

#### Test Scenario 2 (Downgrade)
```bash
# 1. Create subscription on Jan 3
curl -X POST http://localhost:3000/api/stripe/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "professional",
    "billingCycle": "monthly"
  }'

# 2. Complete Stripe checkout

# 3. Preview downgrade on Jan 6
curl -X POST http://localhost:3000/api/subscriptions/preview-change \
  -H "Content-Type: application/json" \
  -d '{
    "subscriptionId": "sub_def456",
    "newPlanId": "professional"
  }'

# 4. Execute downgrade
curl -X POST http://localhost:3000/api/subscriptions/change-plan \
  -H "Content-Type: application/json" \
  -d '{
    "subscriptionId": "sub_def456",
    "newPlanId": "professional"
  }'
```

---

### Proration Formula Reference

**Upgrade Proration:**
```
Immediate Charge = (New Price - Old Price) × (Days Remaining / Days in Period)

Example (Jan 2 → Jan 4 upgrade):
= ($99 - $49) × (29/31)
= $50 × 0.935
= $46.75 (Stripe's actual calculation may vary slightly)
```

**Downgrade Proration:**
```
Credit = (Old Price - New Price) × (Days Remaining / Days in Period)

Example (Jan 3 → Jan 6 downgrade):
= ($299 - $99) × (28/31)
= $200 × 0.903
= $180.60 (Stripe's actual calculation may vary slightly)
```

**Note:** Stripe's proration calculation accounts for the exact timestamp of changes, not just dates, so amounts may differ slightly from simple day-based calculations.

---

This implementation ensures fair, transparent, and automated handling of subscription changes while maintaining data integrity and providing excellent customer experience!
