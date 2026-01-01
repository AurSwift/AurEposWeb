# Stripe Subscription Implementation Plan

## Customer Registration → Plan Selection → Billing Cycle → Stripe → Dashboard

## 📋 Executive Summary

This plan implements a complete subscription flow using Stripe for payment processing, following the business rules from `businessflows.md` and license key generation from `activationlicensekeybusinesslogicforepos.md`.

---

## 🎯 User Flow Overview

```
1. Landing Page (/)
   ↓
2. Pricing Page (/pricing) - View plans
   ↓
3. Signup Page (/signup) - Registration + Plan Selection
   ↓
4. Billing Cycle Selection - Monthly/Annual
   ↓
5. Stripe Checkout - Payment processing
   ↓
6. Stripe Webhook - Subscription confirmation
   ↓
7. License Key Generation - Automatic
   ↓
8. Dashboard (/dashboard) - Success page with license key
```

---

## 📁 File Structure

```
web/
├── app/
│   ├── pricing/
│   │   └── page.tsx                    # Pricing page with plan comparison
│   ├── signup/
│   │   └── page.tsx                     # Registration + plan selection
│   ├── checkout/
│   │   └── page.tsx                     # Stripe Checkout redirect page
│   ├── success/
│   │   └── page.tsx                     # Post-payment success page
│   ├── api/
│   │   ├── stripe/
│   │   │   ├── create-checkout/route.ts # Create Stripe Checkout session
│   │   │   ├── webhook/route.ts         # Handle Stripe webhooks
│   │   │   └── portal/route.ts          # Customer portal (manage billing)
│   │   └── subscriptions/
│   │       └── create/route.ts          # Create subscription (server action)
│   └── dashboard/
│       └── page.tsx                     # Dashboard with license key
│
├── lib/
│   ├── stripe/
│   │   ├── client.ts                    # Stripe client initialization
│   │   ├── plans.ts                     # Plan definitions & pricing
│   │   └── utils.ts                     # Stripe utility functions
│   ├── license/
│   │   └── generator.ts                 # License key generation logic
│   └── subscriptions/
│       └── service.ts                   # Subscription business logic
│
└── components/
    ├── pricing/
    │   ├── plan-card.tsx                # Individual plan card
    │   ├── billing-toggle.tsx           # Monthly/Annual toggle
    │   └── feature-list.tsx             # Plan features display
    └── checkout/
        └── checkout-button.tsx          # Stripe Checkout button
```

---

## 🔧 Phase 1: Setup & Configuration

### Step 1.1: Install Stripe Dependencies

```bash
pnpm add stripe @stripe/stripe-js
pnpm add -D @types/stripe
```

### Step 1.2: Environment Variables

Add to `.env.local`:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...  # For webhook verification
STRIPE_PRICE_ID_BASIC_MONTHLY=price_...
STRIPE_PRICE_ID_BASIC_ANNUAL=price_...
STRIPE_PRICE_ID_PRO_MONTHLY=price_...
STRIPE_PRICE_ID_PRO_ANNUAL=price_...
STRIPE_PRICE_ID_ENTERPRISE_MONTHLY=price_...
STRIPE_PRICE_ID_ENTERPRISE_ANNUAL=price_...
```

### Step 1.3: Create Stripe Products & Prices

In Stripe Dashboard:

1. Create Products: Basic, Professional, Enterprise
2. Create Prices for each:
   - Monthly prices
   - Annual prices (with 15-20% discount)
3. Copy Price IDs to `.env.local`

---

## 📊 Phase 2: Plan Definitions & Pricing

### Step 2.1: Create Plan Configuration

**File:** `lib/stripe/plans.ts`

```typescript
export type PlanId = "basic" | "professional" | "enterprise";
export type BillingCycle = "monthly" | "annual";

export interface PlanFeatures {
  maxTerminals: number;
  features: string[];
  limits: Record<string, any>;
}

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  priceMonthly: number;
  priceAnnual: number;
  annualDiscount: number; // Percentage (e.g., 20 for 20%)
  stripePriceIdMonthly: string;
  stripePriceIdAnnual: string;
  features: PlanFeatures;
  popular?: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  basic: {
    id: "basic",
    name: "Basic",
    description: "Perfect for small businesses",
    priceMonthly: 49,
    priceAnnual: 470, // 20% discount: 49 * 12 * 0.8
    annualDiscount: 20,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ID_BASIC_MONTHLY!,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_ID_BASIC_ANNUAL!,
    features: {
      maxTerminals: 1,
      features: [
        "Single terminal",
        "Basic inventory management",
        "Sales reporting",
        "Email support",
      ],
      limits: {
        users: 1,
        storage: "5GB",
      },
    },
  },
  professional: {
    id: "professional",
    name: "Professional",
    description: "For growing businesses",
    priceMonthly: 99,
    priceAnnual: 950, // 20% discount: 99 * 12 * 0.8
    annualDiscount: 20,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ID_PRO_MONTHLY!,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_ID_PRO_ANNUAL!,
    popular: true,
    features: {
      maxTerminals: 5,
      features: [
        "Up to 5 terminals",
        "Advanced inventory",
        "Multi-location support",
        "Advanced reporting & analytics",
        "Priority email support",
        "API access",
      ],
      limits: {
        users: 5,
        storage: "50GB",
      },
    },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "For large organizations",
    priceMonthly: 299,
    priceAnnual: 2870, // 20% discount: 299 * 12 * 0.8
    annualDiscount: 20,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ID_ENTERPRISE_MONTHLY!,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_ID_ENTERPRISE_ANNUAL!,
    features: {
      maxTerminals: -1, // Unlimited
      features: [
        "Unlimited terminals",
        "Custom integrations",
        "Dedicated account manager",
        "24/7 phone support",
        "Custom SLA",
        "White-label options",
      ],
      limits: {
        users: -1, // Unlimited
        storage: "Unlimited",
      },
    },
  },
};

export function getPlan(planId: PlanId): Plan {
  return PLANS[planId];
}

export function getPrice(planId: PlanId, cycle: BillingCycle): number {
  const plan = PLANS[planId];
  return cycle === "monthly" ? plan.priceMonthly : plan.priceAnnual;
}

export function getStripePriceId(planId: PlanId, cycle: BillingCycle): string {
  const plan = PLANS[planId];
  return cycle === "monthly"
    ? plan.stripePriceIdMonthly
    : plan.stripePriceIdAnnual;
}
```

---

## 🔑 Phase 3: License Key Generation

### Step 3.1: License Key Generator

**File:** `lib/license/generator.ts`

```typescript
import crypto from "crypto";
import { db } from "@/lib/db";
import { licenseKeys } from "@/lib/db/schema";
import type { PlanId } from "@/lib/stripe/plans";

/**
 * Generate license key following business rules:
 * Format: EPOS-{PlanCode}-V{Version}-{Random8Char}-{Checksum}
 * Example: EPOS-PRO-V2-7A83B2D4-E9
 */
export function generateLicenseKey(
  planId: PlanId,
  customerId: string,
  subscriptionId: string
): string {
  // Plan code mapping
  const planCodes: Record<PlanId, string> = {
    basic: "BAS",
    professional: "PRO",
    enterprise: "ENT",
  };

  const planCode = planCodes[planId];
  const version = "V2";

  // Generate unique 8-character random string
  const uniquePart = crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()
    .substring(0, 8);

  // Create base key
  const baseKey = `EPOS-${planCode}-${version}-${uniquePart}`;

  // Calculate checksum (simple algorithm)
  const checksum = calculateChecksum(baseKey);

  const licenseKey = `${baseKey}-${checksum}`;

  return licenseKey;
}

function calculateChecksum(key: string): string {
  let sum = 0;
  for (let i = 0; i < key.length; i++) {
    sum += key.charCodeAt(i);
  }
  const checksum = (sum % 256).toString(16).toUpperCase().padStart(2, "0");
  return checksum;
}

/**
 * Validate license key format
 */
export function validateLicenseKeyFormat(key: string): boolean {
  const pattern = /^EPOS-(BAS|PRO|ENT)-V[0-9]-[A-Z0-9]{8}-[A-Z0-9]{2}$/;
  return pattern.test(key);
}

/**
 * Store license key in database
 */
export async function storeLicenseKey(
  licenseKey: string,
  customerId: string,
  subscriptionId: string,
  planId: PlanId,
  maxTerminals: number
) {
  const [stored] = await db
    .insert(licenseKeys)
    .values({
      customerId,
      subscriptionId,
      licenseKey,
      maxTerminals,
      version: "2.0",
      issuedAt: new Date(),
      isActive: true,
    })
    .returning();

  return stored;
}
```

---

## 💳 Phase 4: Stripe Integration

### Step 4.1: Stripe Client

**File:** `lib/stripe/client.ts`

```typescript
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
});
```

### Step 4.2: Create Checkout Session API

**File:** `app/api/stripe/create-checkout/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { getStripePriceId, getPlan } from "@/lib/stripe/plans";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId, billingCycle } = await request.json();

    if (!planId || !billingCycle) {
      return NextResponse.json(
        { error: "Plan ID and billing cycle are required" },
        { status: 400 }
      );
    }

    // Get customer record
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, session.user.id))
      .limit(1);

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Get Stripe price ID
    const priceId = getStripePriceId(planId, billingCycle);
    const plan = getPlan(planId);

    // Create or get Stripe customer
    let stripeCustomerId: string;

    if (customer.stripeCustomerId) {
      stripeCustomerId = customer.stripeCustomerId;
    } else {
      const stripeCustomer = await stripe.customers.create({
        email: customer.email,
        name: customer.companyName || undefined,
        metadata: {
          customerId: customer.id,
          userId: session.user.id,
        },
      });
      stripeCustomerId = stripeCustomer.id;

      // Update customer with Stripe ID
      await db
        .update(customers)
        .set({ stripeCustomerId: stripeCustomer.id })
        .where(eq(customers.id, customer.id));
    }

    // Create Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/signup?canceled=true`,
      metadata: {
        customerId: customer.id,
        userId: session.user.id,
        planId,
        billingCycle,
      },
      subscription_data: {
        metadata: {
          customerId: customer.id,
          planId,
          billingCycle,
        },
        trial_period_days: billingCycle === "annual" ? 14 : 7, // Trial period
      },
    });

    return NextResponse.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
```

---

## 🔔 Phase 5: Stripe Webhook Handler

### Step 5.1: Webhook Route

**File:** `app/api/stripe/webhook/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { db } from "@/lib/db";
import { customers, subscriptions, licenseKeys } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateLicenseKey, storeLicenseKey } from "@/lib/license/generator";
import { getPlan } from "@/lib/stripe/plans";
import Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = session.metadata?.customerId;
  const planId = session.metadata?.planId as PlanId;
  const billingCycle = session.metadata?.billingCycle as BillingCycle;

  if (!customerId || !planId || !billingCycle) {
    throw new Error("Missing metadata in checkout session");
  }

  // Get subscription from Stripe
  const subscriptionId = session.subscription as string;
  const stripeSubscription = await stripe.subscriptions.retrieve(
    subscriptionId
  );

  // Get customer
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);

  if (!customer) {
    throw new Error("Customer not found");
  }

  const plan = getPlan(planId);
  const price =
    billingCycle === "monthly" ? plan.priceMonthly : plan.priceAnnual;

  // Calculate billing period dates
  const currentPeriodStart = new Date(
    stripeSubscription.current_period_start * 1000
  );
  const currentPeriodEnd = new Date(
    stripeSubscription.current_period_end * 1000
  );
  const trialEnd = stripeSubscription.trial_end
    ? new Date(stripeSubscription.trial_end * 1000)
    : null;

  // Create subscription record
  const [subscription] = await db
    .insert(subscriptions)
    .values({
      customerId: customer.id,
      planId,
      planType: planId, // Keep for backward compatibility
      billingCycle,
      price: price.toString(),
      status: stripeSubscription.status === "trialing" ? "trialing" : "active",
      currentPeriodStart,
      currentPeriodEnd,
      nextBillingDate: currentPeriodEnd,
      trialStart: trialEnd ? currentPeriodStart : null,
      trialEnd,
      autoRenew: !stripeSubscription.cancel_at_period_end,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: stripeSubscription.customer as string,
      metadata: {
        stripePriceId: stripeSubscription.items.data[0].price.id,
      },
    })
    .returning();

  // Generate and store license key
  const licenseKey = generateLicenseKey(planId, customer.id, subscription.id);

  await storeLicenseKey(
    licenseKey,
    customer.id,
    subscription.id,
    planId,
    plan.features.maxTerminals
  );

  // Create payment record
  await db.insert(payments).values({
    customerId: customer.id,
    subscriptionId: subscription.id,
    paymentType: "subscription",
    amount: price.toString(),
    currency: "USD",
    status: "completed",
    stripePaymentId: session.payment_intent as string,
    billingPeriodStart: currentPeriodStart,
    billingPeriodEnd: currentPeriodEnd,
    paidAt: new Date(),
  });

  console.log(
    `Subscription created: ${subscription.id}, License: ${licenseKey}`
  );
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // Update subscription status, dates, etc.
  // Handle plan changes, cancellations, etc.
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // Mark subscription as cancelled
  // Revoke license keys
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  // Update subscription status to active
  // Create payment record
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // Update subscription status to past_due
  // Send notification email
}
```

---

## 📄 Phase 6: Updated Signup Flow

### Step 6.1: Multi-Step Signup Form

**File:** `app/signup/page.tsx` (Updated)

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { PLANS, type PlanId, type BillingCycle } from "@/lib/stripe/plans";
import { PlanCard } from "@/components/pricing/plan-card";
import { BillingToggle } from "@/components/pricing/billing-toggle";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"account" | "plan" | "billing">("account");
  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    password: "",
    planId: "" as PlanId | "",
    billingCycle: "monthly" as BillingCycle,
    agreeToTerms: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1: Account Creation
  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.companyName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Signup failed");
        return;
      }

      // Auto sign in
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Account created but sign in failed");
        return;
      }

      // Move to plan selection
      setStep("plan");
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Plan Selection
  const handlePlanSelect = (planId: PlanId) => {
    setFormData({ ...formData, planId });
    setStep("billing");
  };

  // Step 3: Billing Cycle & Checkout
  const handleCheckout = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: formData.planId,
          billingCycle: formData.billingCycle,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create checkout");
        return;
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError("Failed to start checkout");
    } finally {
      setIsLoading(false);
    }
  };

  // Render based on step
  if (step === "account") {
    return <AccountFormStep />;
  }

  if (step === "plan") {
    return <PlanSelectionStep />;
  }

  if (step === "billing") {
    return <BillingStep />;
  }
}
```

---

## ✅ Phase 7: Success Page

### Step 7.1: Success Page with License Key

**File:** `app/success/page.tsx`

```typescript
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { customers, subscriptions, licenseKeys } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { LicenseKeyCard } from "@/components/license-key-card";
import { DownloadButton } from "@/components/download-card";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Get customer with subscription and license key
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.userId, session.user.id))
    .limit(1);

  if (!customer) {
    redirect("/signup");
  }

  // Get latest subscription
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.customerId, customer.id))
    .orderBy(subscriptions.createdAt)
    .limit(1);

  // Get license key
  const [licenseKey] = await db
    .select()
    .from(licenseKeys)
    .where(eq(licenseKeys.customerId, customer.id))
    .limit(1);

  return (
    <div className="container mx-auto py-12">
      <h1>Welcome to aurswift!</h1>
      <LicenseKeyCard licenseKey={licenseKey?.licenseKey} />
      <DownloadButton />
      {/* Activation instructions */}
    </div>
  );
}
```

---

## 🔄 Phase 8: Server Actions (Alternative Approach)

### Step 8.1: Subscription Server Action

**File:** `app/actions/subscriptions.ts`

```typescript
"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe/client";
import { getStripePriceId } from "@/lib/stripe/plans";

export async function createSubscriptionAction(
  planId: string,
  billingCycle: "monthly" | "annual"
) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // Get customer
  // Create Stripe Checkout
  // Return checkout URL

  return { url: checkoutUrl };
}
```

---

## 📝 Implementation Checklist

### Phase 1: Setup ✅

- [ ] Install Stripe packages
- [ ] Add Stripe environment variables
- [ ] Create Stripe products & prices
- [ ] Configure Stripe webhook endpoint

### Phase 2: Plan Configuration ✅

- [ ] Create `lib/stripe/plans.ts`
- [ ] Define all plans with features
- [ ] Add pricing logic
- [ ] Add annual discount calculation

### Phase 3: License Generation ✅

- [ ] Create `lib/license/generator.ts`
- [ ] Implement key format: `EPOS-{Plan}-V2-{Random}-{Checksum}`
- [ ] Add validation function
- [ ] Add storage function

### Phase 4: Stripe Integration ✅

- [ ] Create Stripe client
- [ ] Create checkout session API
- [ ] Handle customer creation
- [ ] Add metadata to sessions

### Phase 5: Webhooks ✅

- [ ] Create webhook route
- [ ] Handle `checkout.session.completed`
- [ ] Handle `subscription.created`
- [ ] Handle `subscription.updated`
- [ ] Handle `subscription.deleted`
- [ ] Handle payment events
- [ ] Generate license keys on success
- [ ] Create subscription records
- [ ] Create payment records

### Phase 6: UI Updates ✅

- [ ] Update signup page (multi-step)
- [ ] Create plan selection component
- [ ] Create billing cycle toggle
- [ ] Add Stripe Checkout integration
- [ ] Create success page
- [ ] Add license key display

### Phase 7: Database Updates ✅

- [ ] Add `stripeCustomerId` to customers table
- [ ] Add `stripeSubscriptionId` to subscriptions table
- [ ] Update schema if needed

### Phase 8: Testing ✅

- [ ] Test signup flow
- [ ] Test Stripe Checkout
- [ ] Test webhook handling
- [ ] Test license key generation
- [ ] Test dashboard display

---

## 🎨 UI/UX Flow Details

### Step 1: Account Creation

- Form fields: Company Name, Email, Password
- Validation: Email format, password strength
- Terms acceptance required
- On success: Auto sign-in → Move to plan selection

### Step 2: Plan Selection

- Display all 3 plans (Basic, Professional, Enterprise)
- Show features for each plan
- Highlight "Most Popular" (Professional)
- Show pricing (monthly by default)
- Billing cycle toggle visible
- "Continue" button → Move to billing confirmation

### Step 3: Billing Confirmation

- Show selected plan
- Show billing cycle (Monthly/Annual)
- Show price (with annual discount if selected)
- Show savings for annual
- "Proceed to Payment" button → Stripe Checkout

### Step 4: Stripe Checkout

- Redirect to Stripe hosted page
- Customer enters payment details
- Stripe processes payment
- On success: Redirect to `/success`

### Step 5: Success Page

- Welcome message
- License key displayed (with copy button)
- Download link for EPOS software
- Activation instructions
- "Go to Dashboard" button

---

## 🔐 Security Considerations

1. **Webhook Verification**: Always verify Stripe webhook signatures
2. **Server-Side Only**: Never expose Stripe secret keys to client
3. **Idempotency**: Handle duplicate webhook events
4. **Error Handling**: Graceful error handling at each step
5. **Rate Limiting**: Prevent abuse of signup/checkout endpoints

---

## 📊 Database Schema Updates Needed

Add to `customers` table:

```typescript
stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
```

Add to `subscriptions` table:

```typescript
stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
```

---

## 🚀 Deployment Checklist

1. **Stripe Configuration**:

   - Switch to live keys
   - Configure production webhook endpoint
   - Test webhook delivery

2. **Environment Variables**:

   - Add all Stripe keys to production
   - Verify webhook secret

3. **Testing**:
   - Test with Stripe test cards
   - Verify webhook handling
   - Test license key generation
   - Verify dashboard display

---

## 📚 Next Steps After Implementation

1. **Email Notifications**:

   - Welcome email with license key
   - Payment confirmation
   - Subscription renewal reminders

2. **Customer Portal**:

   - Manage subscription
   - Update payment method
   - View invoices
   - Cancel subscription

3. **Analytics**:
   - Track conversion rates
   - Monitor subscription metrics
   - License activation rates

---

This plan provides a complete, production-ready implementation of the subscription flow with Stripe integration, following all business rules from your documentation.
