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
2. Selects plan (Basic/Professional/Enterprise)
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
   - Product: "Enterprise Plan"
     - Price: $299/month (recurring)
     - Price: $2,870/year (recurring, 20% discount)
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
STRIPE_PRICE_ID_ENTERPRISE_MONTHLY=price_...
STRIPE_PRICE_ID_ENTERPRISE_ANNUAL=price_...
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
│  [Basic]    [Professional★] [Enterprise]
│  $49/mo     $99/mo        $299/mo  │
│                                     │
│  Features:                          │
│  • Single terminal                  │
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
│  Welcome to Auraswif! ✅            │
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

This plan provides everything needed to implement the complete subscription flow with Stripe integration!

