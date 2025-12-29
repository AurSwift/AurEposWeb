# Detailed Subscription Flow Implementation Plan

## Customer Registration → Plan Selection → Billing Cycle → Stripe → Dashboard

---

## 🎯 Complete User Journey

```
┌─────────────────────────────────────────────────────────────┐
│                    LANDING PAGE (/)                         │
│  - View pricing                                             │
│  - Click "Get Started" or "Select Plan"                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 1: ACCOUNT CREATION (/signup)              │
│  - Company Name                                             │
│  - Email                                                    │
│  - Password                                                 │
│  - Terms & Conditions checkbox                              │
│  - Submit → Creates user + customer record                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│          STEP 2: PLAN SELECTION (/signup?step=plan)          │
│  - Display 3 plans (Basic, Professional, Enterprise)        │
│  - Show features, pricing, limits                           │
│  - Highlight "Most Popular"                                  │
│  - User selects plan                                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│      STEP 3: BILLING CYCLE (/signup?step=billing)            │
│  - Toggle: Monthly / Annual                                 │
│  - Show price difference                                    │
│  - Show annual savings (15-20%)                             │
│  - "Proceed to Payment" button                              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│         STEP 4: STRIPE CHECKOUT (External)                   │
│  - Redirect to Stripe hosted checkout                       │
│  - Customer enters payment details                          │
│  - Stripe processes payment                                 │
│  - On success: Webhook fires → Creates subscription         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│          STEP 5: SUCCESS PAGE (/success)                     │
│  - Welcome message                                          │
│  - License key displayed                                    │
│  - Download link for EPOS software                          │
│  - Activation instructions                                  │
│  - "Go to Dashboard" button                                 │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              DASHBOARD (/dashboard)                          │
│  - Current subscription details                             │
│  - License key (with copy button)                           │
│  - Active terminals count                                   │
│  - Billing information                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Required Dependencies

```bash
pnpm add stripe @stripe/stripe-js
```

---

## 🔧 Implementation Steps

### STEP 1: Update Database Schema

Add Stripe-related fields to existing tables:

**File:** `lib/db/schema.ts`

```typescript
// Update customers table
export const customers = pgTable("customers", {
  // ... existing fields
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
});

// Update subscriptions table
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

### STEP 2: Create Plan Configuration

**File:** `lib/stripe/plans.ts` (NEW)

```typescript
export type PlanId = "basic" | "professional" | "enterprise";
export type BillingCycle = "monthly" | "annual";

export interface PlanFeatures {
  maxTerminals: number;
  features: string[];
  limits: {
    users: number;
    storage: string;
    apiAccess: boolean;
    support: string;
  };
}

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  priceMonthly: number;
  priceAnnual: number;
  annualDiscountPercent: number;
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
    priceAnnual: 470, // 20% discount
    annualDiscountPercent: 20,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ID_BASIC_MONTHLY!,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_ID_BASIC_ANNUAL!,
    features: {
      maxTerminals: 1,
      features: [
        "Single terminal",
        "Basic inventory management",
        "Sales reporting",
        "Email support (48hr response)",
      ],
      limits: {
        users: 1,
        storage: "5GB",
        apiAccess: false,
        support: "email",
      },
    },
  },
  professional: {
    id: "professional",
    name: "Professional",
    description: "For growing businesses",
    priceMonthly: 99,
    priceAnnual: 950, // 20% discount
    annualDiscountPercent: 20,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ID_PRO_MONTHLY!,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_ID_PRO_ANNUAL!,
    popular: true,
    features: {
      maxTerminals: 5,
      features: [
        "Up to 5 terminals",
        "Advanced inventory management",
        "Multi-location support",
        "Advanced reporting & analytics",
        "API access",
        "Priority email support (24hr response)",
      ],
      limits: {
        users: 5,
        storage: "50GB",
        apiAccess: true,
        support: "priority_email",
      },
    },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "For large organizations",
    priceMonthly: 299,
    priceAnnual: 2870, // 20% discount
    annualDiscountPercent: 20,
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
        apiAccess: true,
        support: "phone_24_7",
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

export function calculateAnnualSavings(planId: PlanId): number {
  const plan = PLANS[planId];
  const monthlyTotal = plan.priceMonthly * 12;
  return monthlyTotal - plan.priceAnnual;
}
```

---

### STEP 3: License Key Generator

**File:** `lib/license/generator.ts` (NEW)

```typescript
import crypto from "crypto";
import { db } from "@/lib/db";
import { licenseKeys } from "@/lib/db/schema";
import type { PlanId } from "@/lib/stripe/plans";

const PLAN_CODES: Record<PlanId, string> = {
  basic: "BAS",
  professional: "PRO",
  enterprise: "ENT",
};

/**
 * Generate license key following business rules:
 * Format: EPOS-{PlanCode}-V{Version}-{Random8Char}-{Checksum}
 * Example: EPOS-PRO-V2-7A83B2D4-E9
 */
export function generateLicenseKey(planId: PlanId, customerId: string): string {
  const planCode = PLAN_CODES[planId];
  const version = "V2";

  // Generate unique 8-character random string (cryptographically secure)
  const uniquePart = crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()
    .substring(0, 8);

  // Create base key
  const baseKey = `EPOS-${planCode}-${version}-${uniquePart}`;

  // Calculate checksum
  const checksum = calculateChecksum(baseKey);

  const licenseKey = `${baseKey}-${checksum}`;

  return licenseKey;
}

/**
 * Calculate checksum for license key validation
 */
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

### STEP 4: Stripe Client Setup

**File:** `lib/stripe/client.ts` (NEW)

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

### STEP 5: Create Checkout Session API

**File:** `app/api/stripe/create-checkout/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { getStripePriceId, getPlan } from "@/lib/stripe/plans";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { PlanId, BillingCycle } from "@/lib/stripe/plans";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId, billingCycle } = (await request.json()) as {
      planId: PlanId;
      billingCycle: BillingCycle;
    };

    if (!planId || !billingCycle) {
      return NextResponse.json(
        { error: "Plan ID and billing cycle are required" },
        { status: 400 }
      );
    }

    // Validate plan ID
    if (!["basic", "professional", "enterprise"].includes(planId)) {
      return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 });
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

    // Calculate trial period (7 days for monthly, 14 days for annual)
    const trialPeriodDays = billingCycle === "annual" ? 14 : 7;

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
      cancel_url: `${process.env.NEXTAUTH_URL}/signup?canceled=true&plan=${planId}`,
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
        trial_period_days: trialPeriodDays,
      },
      allow_promotion_codes: true, // Allow discount codes
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

### STEP 6: Stripe Webhook Handler

**File:** `app/api/stripe/webhook/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { db } from "@/lib/db";
import {
  customers,
  subscriptions,
  licenseKeys,
  payments,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateLicenseKey, storeLicenseKey } from "@/lib/license/generator";
import { getPlan, type PlanId } from "@/lib/stripe/plans";
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
  const billingCycle = session.metadata?.billingCycle as "monthly" | "annual";

  if (!customerId || !planId || !billingCycle) {
    throw new Error("Missing metadata in checkout session");
  }

  // Get subscription from Stripe
  const subscriptionId = session.subscription as string;
  if (!subscriptionId) {
    throw new Error("No subscription ID in checkout session");
  }

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
  const trialStart = stripeSubscription.trial_start
    ? new Date(stripeSubscription.trial_start * 1000)
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
      trialStart,
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
  const licenseKey = generateLicenseKey(planId, customer.id);

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
    `✅ Subscription created: ${subscription.id}, License: ${licenseKey}`
  );
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const stripeSubscriptionId = subscription.id;
  const customerId = subscription.metadata?.customerId;

  if (!customerId) return;

  // Find subscription by Stripe ID
  const [existingSubscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  if (!existingSubscription) return;

  // Update subscription
  await db
    .update(subscriptions)
    .set({
      status:
        subscription.status === "active"
          ? "active"
          : subscription.status === "trialing"
          ? "trialing"
          : subscription.status === "past_due"
          ? "past_due"
          : "cancelled",
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      nextBillingDate: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, existingSubscription.id));
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const stripeSubscriptionId = subscription.id;

  // Update subscription status
  await db
    .update(subscriptions)
    .set({
      status: "cancelled",
      canceledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));

  // Revoke license keys
  await db
    .update(licenseKeys)
    .set({
      isActive: false,
      revokedAt: new Date(),
      revocationReason: "Subscription cancelled",
    })
    .where(
      eq(licenseKeys.subscriptionId, subscription.metadata?.subscriptionId)
    );
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  // Find subscription
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (!subscription) return;

  // Update subscription to active
  await db
    .update(subscriptions)
    .set({
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscription.id));

  // Create payment record
  await db.insert(payments).values({
    customerId: subscription.customerId,
    subscriptionId: subscription.id,
    paymentType: "subscription",
    amount: (invoice.amount_paid / 100).toString(), // Convert from cents
    currency: invoice.currency.toUpperCase(),
    status: "completed",
    stripePaymentId: invoice.payment_intent as string,
    billingPeriodStart: new Date(invoice.period_start * 1000),
    billingPeriodEnd: new Date(invoice.period_end * 1000),
    paidAt: new Date(),
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  // Update subscription to past_due
  await db
    .update(subscriptions)
    .set({
      status: "past_due",
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));

  // TODO: Send notification email to customer
}
```

---

## 📱 UI Components

### Component 1: Plan Card

**File:** `components/pricing/plan-card.tsx` (NEW)

```typescript
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import type { Plan } from "@/lib/stripe/plans";

interface PlanCardProps {
  plan: Plan;
  billingCycle: "monthly" | "annual";
  onSelect: () => void;
  isSelected?: boolean;
}

export function PlanCard({
  plan,
  billingCycle,
  onSelect,
  isSelected,
}: PlanCardProps) {
  const price =
    billingCycle === "monthly" ? plan.priceMonthly : plan.priceAnnual;
  const savings =
    billingCycle === "annual" ? plan.priceMonthly * 12 - plan.priceAnnual : 0;

  return (
    <Card className={isSelected ? "border-primary border-2" : ""}>
      {plan.popular && (
        <div className="text-center">
          <Badge className="mb-2">Most Popular</Badge>
        </div>
      )}
      <CardHeader>
        <CardTitle>{plan.name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
        <div className="mt-4">
          <span className="text-4xl font-bold">${price}</span>
          <span className="text-muted-foreground">
            /{billingCycle === "monthly" ? "month" : "year"}
          </span>
          {savings > 0 && (
            <p className="text-sm text-green-600 mt-1">
              Save ${savings} per year
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 mb-6">
          {plan.features.features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <Check className="h-5 w-5 text-green-500 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <Button
          onClick={onSelect}
          className="w-full"
          variant={plan.popular ? "default" : "outline"}
        >
          Select Plan
        </Button>
      </CardContent>
    </Card>
  );
}
```

---

## 🎬 Complete Flow Implementation

This plan provides:

1. ✅ Complete file structure
2. ✅ All code implementations
3. ✅ Database schema updates
4. ✅ Stripe integration
5. ✅ License key generation
6. ✅ Webhook handling
7. ✅ UI components

**Next:** Start implementing each file in order, testing as you go!
