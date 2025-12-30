# Stripe Pricing Model Setup Guide

## Creating Products & Prices for Monthly and Annual Subscriptions

---

## 🎯 Pricing Model Type: **Recurring Subscriptions**

For a SaaS subscription model (like your EPOS platform), you should use:

- **Product Type**: `Service` or `Software`
- **Price Type**: `Recurring`
- **Billing Period**: `Monthly` and `Annual` (separate prices for each)

---

## 📋 Step-by-Step: Create Products in Stripe Dashboard

### Option 1: Using Stripe Dashboard (Recommended for Production)

#### Step 1: Create Products

1. Go to **Stripe Dashboard** → **Products**
2. Click **"+ Add product"**

**For Basic Plan:**

```
Product Name: Basic Plan
Description: Perfect for small businesses - Single terminal, basic inventory & sales
```

**For Professional Plan:**

```
Product Name: Professional Plan
Description: For growing businesses - Multi-terminal, advanced reporting, inventory management
```

**For Enterprise Plan:**

```
Product Name: Enterprise Plan
Description: For large organizations - Unlimited terminals, API access, custom integrations, priority support
```

#### Step 2: Create Prices for Each Product

For **each product**, create **TWO prices**:

**Basic Plan - Monthly Price:**

```
Price: $49.00
Billing period: Monthly
Recurring: Yes
Currency: USD
```

**Basic Plan - Annual Price:**

```
Price: $470.00  (20% discount: $49 × 12 × 0.8 = $470.40, rounded to $470)
Billing period: Yearly
Recurring: Yes
Currency: USD
```

**Professional Plan - Monthly Price:**

```
Price: $99.00
Billing period: Monthly
Recurring: Yes
Currency: USD
```

**Professional Plan - Annual Price:**

```
Price: $950.00  (20% discount: $99 × 12 × 0.8 = $950.40, rounded to $950)
Billing period: Yearly
Recurring: Yes
Currency: USD
```

**Enterprise Plan - Monthly Price:**

```
Price: $299.00
Billing period: Monthly
Recurring: Yes
Currency: USD
```

**Enterprise Plan - Annual Price:**

```
Price: $2,870.00  (20% discount: $299 × 12 × 0.8 = $2,870.40, rounded to $2,870)
Billing period: Yearly
Recurring: Yes
Currency: USD
```

---

## 🔧 Pricing Model Configuration Details

### Recurring Subscription Settings

For each price, configure:

1. **Billing Period**:

   - Monthly: `month`
   - Annual: `year`

2. **Recurring**: ✅ **Yes** (enabled)

3. **Usage Type**: `Licensed` (not metered)

   - This means customers pay a fixed amount regardless of usage

4. **Aggregation Strategy**: Not applicable (for licensed products)

5. **Trial Period** (Optional):
   - You can set trial periods at checkout time
   - Or set default trial: 7 days (monthly), 14 days (annual)

---

## 📊 Complete Price Structure

| Plan         | Monthly Price | Annual Price | Annual Savings |
| ------------ | ------------- | ------------ | -------------- |
| Basic        | $49/month     | $470/year    | $118 (20%)     |
| Professional | $99/month     | $950/year    | $238 (20%)     |
| Enterprise   | $299/month    | $2,870/year  | $718 (20%)     |

---

## 💻 Option 2: Create via Stripe API (For Automation)

If you want to create products programmatically:

```typescript
import { stripe } from "@/lib/stripe/client";

// Create Basic Plan Product
const basicProduct = await stripe.products.create({
  name: "Basic Plan",
  description:
    "Perfect for small businesses - Single terminal, basic inventory & sales",
});

// Create Basic Monthly Price
const basicMonthlyPrice = await stripe.prices.create({
  product: basicProduct.id,
  unit_amount: 4900, // $49.00 in cents
  currency: "usd",
  recurring: {
    interval: "month",
  },
});

// Create Basic Annual Price
const basicAnnualPrice = await stripe.prices.create({
  product: basicProduct.id,
  unit_amount: 47000, // $470.00 in cents
  currency: "usd",
  recurring: {
    interval: "year",
  },
});

// Repeat for Professional and Enterprise plans...
```

---

## 🔑 Important: Copy Price IDs

After creating prices, **copy the Price IDs** (they start with `price_...`) and add to your `.env.local`:

```env
# Stripe Price IDs
STRIPE_PRICE_ID_BASIC_MONTHLY=price_1ABC123...
STRIPE_PRICE_ID_BASIC_ANNUAL=price_1DEF456...
STRIPE_PRICE_ID_PRO_MONTHLY=price_1GHI789...
STRIPE_PRICE_ID_PRO_ANNUAL=price_1JKL012...
STRIPE_PRICE_ID_ENTERPRISE_MONTHLY=price_1MNO345...
STRIPE_PRICE_ID_ENTERPRISE_ANNUAL=price_1PQR678...
```

---

## ✅ Pricing Model Type Summary

### For Your EPOS SaaS Platform:

**Product Type**: `Service` or `Software`

- ✅ Recurring subscriptions
- ✅ Fixed pricing (not usage-based)
- ✅ Monthly and Annual billing cycles

**Price Configuration**:

```
Type: Recurring
Billing Period: Month or Year
Usage Type: Licensed (fixed price)
Currency: USD
```

**NOT**:

- ❌ One-time payments
- ❌ Metered billing (usage-based)
- ❌ Tiered pricing (different prices for different quantities)

---

## 🎨 Visual Guide: Stripe Dashboard

### Creating a Price in Stripe Dashboard:

```
┌─────────────────────────────────────────┐
│ Create price                            │
├─────────────────────────────────────────┤
│                                         │
│ Price: $49.00                          │
│                                         │
│ Billing period:                        │
│ ○ One time                             │
│ ● Recurring  ← SELECT THIS             │
│                                         │
│ Recurring:                             │
│ Interval: [Monthly ▼]                   │
│                                         │
│ Usage type:                            │
│ ○ Metered                              │
│ ● Licensed  ← SELECT THIS              │
│                                         │
│ [Save price]                            │
└─────────────────────────────────────────┘
```

---

## 🔄 Annual Discount Calculation

To apply 20% discount for annual plans:

**Formula:**

```
Annual Price = (Monthly Price × 12) × 0.8
```

**Examples:**

- Basic: ($49 × 12) × 0.8 = $470.40 → **$470**
- Professional: ($99 × 12) × 0.8 = $950.40 → **$950**
- Enterprise: ($299 × 12) × 0.8 = $2,870.40 → **$2,870**

**Alternative:** You can also use Stripe's built-in discount feature, but setting the annual price directly is simpler.

---

## 📝 Production Checklist

### Before Going Live:

- [ ] Create all 3 products in Stripe Dashboard
- [ ] Create 2 prices for each product (monthly + annual)
- [ ] Verify all prices are set to **Recurring**
- [ ] Verify billing periods are correct (month/year)
- [ ] Copy all 6 Price IDs
- [ ] Add Price IDs to production environment variables
- [ ] Test checkout with test cards
- [ ] Verify webhook events are received
- [ ] Test subscription creation
- [ ] Verify license key generation works

### Test Cards (Stripe Test Mode):

```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Requires Auth: 4000 0025 0000 3155
```

---

## 🚨 Common Mistakes to Avoid

1. **❌ Creating One-Time Prices**

   - Must be **Recurring** for subscriptions

2. **❌ Using Metered Billing**

   - Use **Licensed** for fixed-price subscriptions

3. **❌ Wrong Currency**

   - Ensure all prices use **USD** (or your target currency)

4. **❌ Forgetting to Copy Price IDs**

   - Price IDs are needed in your code

5. **❌ Not Testing Annual Discount**
   - Verify annual prices are correctly discounted

---

## 🔗 Stripe Documentation References

- [Creating Products](https://stripe.com/docs/products-prices/overview)
- [Recurring Prices](https://stripe.com/docs/billing/subscriptions/overview)
- [Price Types](https://stripe.com/docs/products-prices/pricing-models)
- [Billing Periods](https://stripe.com/docs/billing/subscriptions/overview#billing-periods)

---

## 💡 Pro Tips

1. **Use Price IDs in Metadata**

   - Store plan info in subscription metadata for easy lookup

2. **Enable Promotion Codes**

   - Allow discount codes at checkout for marketing campaigns

3. **Set Up Tax Collection**

   - Configure tax settings if selling in multiple regions

4. **Monitor Price Changes**

   - Stripe logs all price modifications for audit trail

5. **Test Mode First**
   - Always test in Stripe test mode before going live

---

## 📊 Example: Complete Product Structure

```
Stripe Dashboard Structure:

Products
├── Basic Plan (prod_ABC123)
│   ├── Monthly Price: $49/month (price_1ABC...)
│   └── Annual Price: $470/year (price_1DEF...)
│
├── Professional Plan (prod_GHI456)
│   ├── Monthly Price: $99/month (price_1GHI...)
│   └── Annual Price: $950/year (price_1JKL...)
│
└── Enterprise Plan (prod_MNO789)
    ├── Monthly Price: $299/month (price_1MNO...)
    └── Annual Price: $2,870/year (price_1PQR...)
```

---

## ✅ Final Answer

**For your EPOS SaaS platform, use:**

**Pricing Model Type**: **Recurring Subscriptions**

- Product Type: Service/Software
- Price Type: Recurring
- Billing Period: Monthly OR Annual (separate prices)
- Usage Type: Licensed (fixed price)
- Currency: USD

This is the standard model for SaaS subscriptions and matches your business requirements perfectly!
