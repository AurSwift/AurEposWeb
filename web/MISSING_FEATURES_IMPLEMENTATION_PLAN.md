# Missing Features Implementation Plan

## Overview

Based on the documentation in `/zdocs`, this document outlines the **missing features** that need to be implemented for the complete EPOS subscription system.

---

## ❌ Current Issues

### 1. **Stripe Environment Variables Not Set**
- **Issue**: `STRIPE_SECRET_KEY` and other Stripe variables are not defined in `.env.local`
- **Impact**: Pricing page cannot load prices from Stripe Dashboard
- **Status**: ❌ **BLOCKING** - Must be fixed first

### 2. **Payment Information Not Saved to Database**
- **Issue**: Payment records are created in webhook but may not be properly linked
- **Impact**: No payment history visible to customers
- **Status**: ⚠️ **PARTIAL** - Webhook creates payment records but needs verification

### 3. **Subscription Cancellation Not Implemented**
- **Issue**: No UI or API to cancel subscriptions
- **Impact**: Customers cannot cancel their subscriptions
- **Status**: ❌ **MISSING**

### 4. **Subscription Plan Updates Not Implemented**
- **Issue**: No UI or API to upgrade/downgrade plans
- **Impact**: Customers cannot change their subscription tier
- **Status**: ❌ **MISSING**

### 5. **Customer Portal Not Implemented**
- **Issue**: No Stripe Customer Portal integration
- **Impact**: Customers cannot manage billing, update payment methods, or view invoices
- **Status**: ❌ **MISSING**

### 6. **Payment History Not Displayed**
- **Issue**: No UI to show past payments and invoices
- **Impact**: Customers cannot view their billing history
- **Status**: ❌ **MISSING**

### 7. **Subscription Status Not Displayed**
- **Issue**: Dashboard doesn't show subscription details
- **Impact**: Customers don't know their current plan, billing cycle, or next billing date
- **Status**: ⚠️ **PARTIAL** - Data exists but UI missing

---

## 🔧 Implementation Phases

### **Phase 1: Fix Stripe Configuration** (CRITICAL)

#### Step 1.1: Add Environment Variables
**File**: `.env.local`

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

#### Step 1.2: Create Stripe Products & Prices
Follow the guide in `STRIPE_PRICING_SETUP_GUIDE.md` to:
1. Create 3 products in Stripe Dashboard
2. Create 2 prices for each (monthly + annual)
3. Copy Price IDs to `.env.local`

#### Step 1.3: Set Product Metadata (Alternative Method)
Instead of using environment variable Price IDs, add metadata to Stripe products:
- Set `metadata.planId` to `basic`, `professional`, or `enterprise`
- The code will automatically fetch prices using this metadata

---

### **Phase 2: Implement Subscription Management**

#### Feature 2.1: Cancel Subscription

**File**: `app/api/subscriptions/cancel/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { subscriptions, customers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { subscriptionId, cancelImmediately } = await request.json();

    // Get customer
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, session.user.id))
      .limit(1);

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Get subscription
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.id, subscriptionId),
          eq(subscriptions.customerId, customer.id)
        )
      )
      .limit(1);

    if (!subscription || !subscription.stripeSubscriptionId) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    // Cancel in Stripe
    if (cancelImmediately) {
      // Cancel immediately
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    } else {
      // Cancel at period end
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Subscription cancellation error:", error);
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 500 }
    );
  }
}
```

**File**: `app/api/subscriptions/reactivate/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { subscriptions, customers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { subscriptionId } = await request.json();

    // Get customer
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, session.user.id))
      .limit(1);

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Get subscription
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.id, subscriptionId),
          eq(subscriptions.customerId, customer.id)
        )
      )
      .limit(1);

    if (!subscription || !subscription.stripeSubscriptionId) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    // Reactivate in Stripe
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Subscription reactivation error:", error);
    return NextResponse.json(
      { error: "Failed to reactivate subscription" },
      { status: 500 }
    );
  }
}
```

#### Feature 2.2: Update/Change Subscription Plan

**File**: `app/api/subscriptions/change-plan/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { subscriptions, customers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getStripePriceId, type PlanId, type BillingCycle } from "@/lib/stripe/plans";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { subscriptionId, newPlanId, newBillingCycle } = await request.json() as {
      subscriptionId: string;
      newPlanId: PlanId;
      newBillingCycle?: BillingCycle;
    };

    // Get customer
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, session.user.id))
      .limit(1);

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Get subscription
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.id, subscriptionId),
          eq(subscriptions.customerId, customer.id)
        )
      )
      .limit(1);

    if (!subscription || !subscription.stripeSubscriptionId) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    // Determine billing cycle (use existing if not provided)
    const billingCycle = newBillingCycle || subscription.billingCycle;

    // Get new Stripe Price ID
    const newPriceId = getStripePriceId(newPlanId, billingCycle);

    // Get current Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    // Update subscription in Stripe
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_behavior: "create_prorations", // Prorate the change
        metadata: {
          ...stripeSubscription.metadata,
          planId: newPlanId,
          billingCycle,
        },
      }
    );

    // Update in database (will be updated by webhook, but update immediately for UX)
    await db
      .update(subscriptions)
      .set({
        planId: newPlanId,
        billingCycle,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id));

    return NextResponse.json({
      success: true,
      subscription: updatedSubscription,
    });
  } catch (error) {
    console.error("Plan change error:", error);
    return NextResponse.json(
      { error: "Failed to change plan" },
      { status: 500 }
    );
  }
}
```

---

### **Phase 3: Implement Customer Portal**

#### Feature 3.1: Stripe Customer Portal Integration

**File**: `app/api/stripe/portal/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
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

    // Get customer
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, session.user.id))
      .limit(1);

    if (!customer || !customer.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer found" },
        { status: 404 }
      );
    }

    // Create portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customer.stripeCustomerId,
      return_url: `${process.env.NEXTAUTH_URL}/dashboard`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("Portal session error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
```

**Usage in Dashboard**:

```typescript
const handleManageBilling = async () => {
  const response = await fetch("/api/stripe/portal", { method: "POST" });
  const data = await response.json();
  if (data.url) {
    window.location.href = data.url;
  }
};
```

---

### **Phase 4: Implement Payment History**

#### Feature 4.1: Get Payment History API

**File**: `app/api/payments/history/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { payments, customers, subscriptions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get customer
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, session.user.id))
      .limit(1);

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Get payment history
    const paymentHistory = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        paymentType: payments.paymentType,
        billingPeriodStart: payments.billingPeriodStart,
        billingPeriodEnd: payments.billingPeriodEnd,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
        stripePaymentId: payments.stripePaymentId,
        subscription: {
          planId: subscriptions.planId,
          billingCycle: subscriptions.billingCycle,
        },
      })
      .from(payments)
      .leftJoin(subscriptions, eq(payments.subscriptionId, subscriptions.id))
      .where(eq(payments.customerId, customer.id))
      .orderBy(desc(payments.createdAt))
      .limit(50);

    return NextResponse.json({ payments: paymentHistory });
  } catch (error) {
    console.error("Payment history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment history" },
      { status: 500 }
    );
  }
}
```

#### Feature 4.2: Payment History UI Component

**File**: `components/dashboard/payment-history.tsx` (NEW)

```typescript
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Payment {
  id: string;
  amount: string;
  currency: string;
  status: string;
  paymentType: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  paidAt: Date;
  subscription: {
    planId: string;
    billingCycle: string;
  } | null;
}

export function PaymentHistory() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPayments() {
      try {
        const response = await fetch("/api/payments/history");
        const data = await response.json();
        if (data.payments) {
          setPayments(data.payments);
        }
      } catch (error) {
        console.error("Failed to fetch payments:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchPayments();
  }, []);

  if (loading) {
    return <div>Loading payment history...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="text-muted-foreground">No payments yet</p>
        ) : (
          <div className="space-y-4">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between border-b pb-4 last:border-0"
              >
                <div>
                  <p className="font-medium">
                    ${payment.amount} {payment.currency}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(payment.paidAt), "MMM dd, yyyy")}
                  </p>
                  {payment.subscription && (
                    <p className="text-xs text-muted-foreground">
                      {payment.subscription.planId} -{" "}
                      {payment.subscription.billingCycle}
                    </p>
                  )}
                </div>
                <Badge
                  variant={
                    payment.status === "completed" ? "default" : "destructive"
                  }
                >
                  {payment.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

### **Phase 5: Implement Dashboard Subscription Display**

#### Feature 5.1: Get Current Subscription API

**File**: `app/api/subscriptions/current/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { subscriptions, customers, licenseKeys } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get customer
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, session.user.id))
      .limit(1);

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Get active subscription
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.customerId, customer.id),
          eq(subscriptions.status, "active")
        )
      )
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    if (!subscription) {
      return NextResponse.json({ subscription: null });
    }

    // Get license keys
    const keys = await db
      .select()
      .from(licenseKeys)
      .where(
        and(
          eq(licenseKeys.subscriptionId, subscription.id),
          eq(licenseKeys.isActive, true)
        )
      );

    return NextResponse.json({
      subscription: {
        ...subscription,
        licenseKeys: keys,
      },
    });
  } catch (error) {
    console.error("Subscription fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}
```

#### Feature 5.2: Subscription Details UI Component

**File**: `components/dashboard/subscription-details.tsx` (NEW)

```typescript
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Copy, ExternalLink } from "lucide-react";

interface Subscription {
  id: string;
  planId: string;
  billingCycle: string;
  price: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  nextBillingDate: Date;
  cancelAtPeriodEnd: boolean;
  licenseKeys: Array<{
    licenseKey: string;
    maxTerminals: number;
  }>;
}

export function SubscriptionDetails() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSubscription() {
      try {
        const response = await fetch("/api/subscriptions/current");
        const data = await response.json();
        setSubscription(data.subscription);
      } catch (error) {
        console.error("Failed to fetch subscription:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSubscription();
  }, []);

  const handleManageBilling = async () => {
    const response = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await response.json();
    if (data.url) {
      window.location.href = data.url;
    }
  };

  const copyLicenseKey = (key: string) => {
    navigator.clipboard.writeText(key);
    // Show toast notification
  };

  if (loading) {
    return <div>Loading subscription...</div>;
  }

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Active Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            You don't have an active subscription yet.
          </p>
          <Button asChild>
            <a href="/pricing">View Plans</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current Subscription</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Plan Info */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold capitalize">
              {subscription.planId} Plan
            </h3>
            <Badge>{subscription.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            ${subscription.price} / {subscription.billingCycle}
          </p>
        </div>

        {/* Billing Info */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Current Period:</span>
            <span>
              {format(new Date(subscription.currentPeriodStart), "MMM dd")} -{" "}
              {format(new Date(subscription.currentPeriodEnd), "MMM dd, yyyy")}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Next Billing Date:</span>
            <span>
              {format(new Date(subscription.nextBillingDate), "MMM dd, yyyy")}
            </span>
          </div>
          {subscription.cancelAtPeriodEnd && (
            <Badge variant="destructive">Cancels on {format(new Date(subscription.currentPeriodEnd), "MMM dd, yyyy")}</Badge>
          )}
        </div>

        {/* License Keys */}
        <div>
          <h4 className="font-medium mb-2">License Keys</h4>
          {subscription.licenseKeys.map((key, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-muted p-3 rounded-md"
            >
              <code className="text-sm">{key.licenseKey}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyLicenseKey(key.licenseKey)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={handleManageBilling} className="flex-1">
            <ExternalLink className="h-4 w-4 mr-2" />
            Manage Billing
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 📋 Implementation Checklist

### Phase 1: Stripe Configuration ✅
- [ ] Add Stripe environment variables to `.env.local`
- [ ] Create Stripe products in Dashboard
- [ ] Create prices (monthly + annual) for each product
- [ ] Copy Price IDs to `.env.local`
- [ ] Test pricing page loads correctly
- [ ] Verify `/api/plans` endpoint returns data

### Phase 2: Subscription Management ✅
- [ ] Create `/api/subscriptions/cancel` route
- [ ] Create `/api/subscriptions/reactivate` route
- [ ] Create `/api/subscriptions/change-plan` route
- [ ] Test cancellation flow
- [ ] Test plan upgrade/downgrade
- [ ] Verify webhook updates database correctly

### Phase 3: Customer Portal ✅
- [ ] Create `/api/stripe/portal` route
- [ ] Add "Manage Billing" button to dashboard
- [ ] Test portal redirect
- [ ] Verify customers can update payment methods
- [ ] Verify customers can view invoices

### Phase 4: Payment History ✅
- [ ] Create `/api/payments/history` route
- [ ] Create `PaymentHistory` component
- [ ] Add to dashboard page
- [ ] Test payment display
- [ ] Verify payment status badges

### Phase 5: Dashboard Display ✅
- [ ] Create `/api/subscriptions/current` route
- [ ] Create `SubscriptionDetails` component
- [ ] Add to dashboard page
- [ ] Test subscription info display
- [ ] Test license key copy functionality

---

## 🚀 Quick Start Guide

### 1. Fix Stripe Configuration (FIRST)

```bash
# 1. Get Stripe API keys from dashboard
# 2. Create products and prices
# 3. Add to .env.local:

STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_BASIC_MONTHLY=price_...
STRIPE_PRICE_ID_BASIC_ANNUAL=price_...
STRIPE_PRICE_ID_PRO_MONTHLY=price_...
STRIPE_PRICE_ID_PRO_ANNUAL=price_...
STRIPE_PRICE_ID_ENTERPRISE_MONTHLY=price_...
STRIPE_PRICE_ID_ENTERPRISE_ANNUAL=price_...

# 4. Restart dev server
npm run dev
```

### 2. Implement Missing Features

Follow the phases above in order:
1. Phase 1: Stripe Config (BLOCKING)
2. Phase 2: Subscription Management
3. Phase 3: Customer Portal
4. Phase 4: Payment History
5. Phase 5: Dashboard Display

---

## 📊 Database Schema Verification

Ensure these tables have the required fields:

### `customers` table
```sql
stripe_customer_id VARCHAR(255)
```

### `subscriptions` table
```sql
stripe_subscription_id VARCHAR(255)
stripe_customer_id VARCHAR(255)
cancel_at_period_end BOOLEAN
canceled_at TIMESTAMP
```

### `payments` table
```sql
customer_id UUID (FK)
subscription_id UUID (FK)
payment_type VARCHAR
amount VARCHAR
currency VARCHAR
status VARCHAR
stripe_payment_id VARCHAR
billing_period_start TIMESTAMP
billing_period_end TIMESTAMP
paid_at TIMESTAMP
```

---

## 🧪 Testing Checklist

- [ ] Pricing page loads with correct prices
- [ ] Signup flow creates customer
- [ ] Stripe checkout redirects correctly
- [ ] Webhook creates subscription
- [ ] License key is generated
- [ ] Payment record is created
- [ ] Dashboard shows subscription details
- [ ] Cancel subscription works
- [ ] Reactivate subscription works
- [ ] Plan upgrade/downgrade works
- [ ] Customer portal opens
- [ ] Payment history displays
- [ ] License key copy works

---

## 📚 Related Documentation

- `STRIPE_PRICING_SETUP_GUIDE.md` - How to set up Stripe products
- `COMPLETE_SUBSCRIPTION_IMPLEMENTATION.md` - Complete flow overview
- `STRIPE_SUBSCRIPTION_IMPLEMENTATION_PLAN.md` - Detailed implementation
- `SUBSCRIPTION_FLOW_DETAILED_PLAN.md` - Flow diagrams

---

**Next Steps**: Start with Phase 1 (Stripe Configuration) as it's blocking all other features.
