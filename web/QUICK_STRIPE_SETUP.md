# Quick Stripe Setup Guide

## 🚀 5-Minute Setup

### Step 1: Get API Keys (2 minutes)

1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy these two keys:
   - **Secret key**: `sk_test_...`
   - **Publishable key**: `pk_test_...`

### Step 2: Create Products (3 minutes)

1. Go to https://dashboard.stripe.com/test/products
2. Click **"+ Add product"**

#### Product 1: Basic Plan
```
Name: Basic Plan
Description: Perfect for small businesses

Monthly Price:
- Amount: $49.00
- Billing period: Monthly
- Recurring: Yes

Annual Price:
- Amount: $470.00
- Billing period: Yearly
- Recurring: Yes

Metadata:
- Key: planId
- Value: basic
```

Copy the Price IDs:
- Monthly: `price_...` 
- Annual: `price_...`

#### Product 2: Professional Plan
```
Name: Professional Plan
Description: For growing businesses

Monthly Price:
- Amount: $99.00
- Billing period: Monthly
- Recurring: Yes

Annual Price:
- Amount: $950.00
- Billing period: Yearly
- Recurring: Yes

Metadata:
- Key: planId
- Value: professional
```

Copy the Price IDs:
- Monthly: `price_...`
- Annual: `price_...`

#### Product 3: Enterprise Plan
```
Name: Enterprise Plan
Description: For large organizations

Monthly Price:
- Amount: $299.00
- Billing period: Monthly
- Recurring: Yes

Annual Price:
- Amount: $2,870.00
- Billing period: Yearly
- Recurring: Yes

Metadata:
- Key: planId
- Value: enterprise
```

Copy the Price IDs:
- Monthly: `price_...`
- Annual: `price_...`

### Step 3: Update .env.local

Open `/Users/admin/Documents/Developer/FullStackDev/AuraSwift/web/.env.local` and add:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_placeholder

# Stripe Price IDs
STRIPE_PRICE_ID_BASIC_MONTHLY=price_YOUR_BASIC_MONTHLY_ID
STRIPE_PRICE_ID_BASIC_ANNUAL=price_YOUR_BASIC_ANNUAL_ID
STRIPE_PRICE_ID_PRO_MONTHLY=price_YOUR_PRO_MONTHLY_ID
STRIPE_PRICE_ID_PRO_ANNUAL=price_YOUR_PRO_ANNUAL_ID
STRIPE_PRICE_ID_ENTERPRISE_MONTHLY=price_YOUR_ENTERPRISE_MONTHLY_ID
STRIPE_PRICE_ID_ENTERPRISE_ANNUAL=price_YOUR_ENTERPRISE_ANNUAL_ID
```

### Step 4: Restart Server

```bash
cd /Users/admin/Documents/Developer/FullStackDev/AuraSwift/web
pkill -f "next dev"
npm run dev
```

### Step 5: Verify

1. Open http://localhost:3000
2. Scroll to pricing section
3. You should see:
   - Basic: $49/month or $470/year
   - Professional: $99/month or $950/year
   - Enterprise: $299/month or $2,870/year

---

## ✅ Verification Checklist

- [ ] Pricing page loads without "Loading plans..." message
- [ ] All 3 plans show correct prices
- [ ] Monthly/Annual toggle updates prices
- [ ] No console errors
- [ ] `/api/plans` endpoint returns 200 status

---

## 🧪 Test the Full Flow

### 1. Create Test Account
- Go to http://localhost:3000/signup
- Fill in company name, email, password
- Click "Sign Up"

### 2. Select Plan
- Choose a plan (e.g., Professional)
- Select billing cycle (Monthly or Annual)
- Click "Select Plan"

### 3. Complete Checkout
- You'll be redirected to Stripe Checkout
- Use test card: `4242 4242 4242 4242`
- Expiry: Any future date (e.g., 12/25)
- CVC: Any 3 digits (e.g., 123)
- Click "Pay"

### 4. Verify Success
- You should be redirected to `/success`
- License key should be displayed
- Dashboard should show subscription details

---

## 🔧 Troubleshooting

### Pricing still not loading?

**Check 1**: Verify environment variables are set
```bash
cd /Users/admin/Documents/Developer/FullStackDev/AuraSwift/web
grep STRIPE .env.local
```

**Check 2**: Restart dev server completely
```bash
pkill -f "next dev"
npm run dev
```

**Check 3**: Check API endpoint
```bash
curl http://localhost:3000/api/plans
```

Should return JSON with plans, not an error.

### Webhook not working?

**For local development**, use Stripe CLI:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Copy the webhook signing secret (starts with whsec_)
# Add it to .env.local as STRIPE_WEBHOOK_SECRET
```

### Database not updating?

**Check webhook logs**:
```bash
# In your terminal running the dev server, look for:
✅ Subscription created: sub_..., License: EPOS-PRO-V2-...
```

**Check database**:
```bash
psql $DATABASE_URL -c "SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT 1;"
```

---

## 📚 Additional Resources

- [Stripe Test Cards](https://stripe.com/docs/testing#cards)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)

---

## 🎯 Next Steps After Setup

Once pricing is working:

1. **Test signup flow** end-to-end
2. **Implement subscription management** (cancel, upgrade)
3. **Add customer portal** (manage billing)
4. **Display payment history**
5. **Show subscription details** in dashboard

See `MISSING_FEATURES_IMPLEMENTATION_PLAN.md` for detailed implementation guide.

---

**Need Help?** Check `CURRENT_STATUS_AND_NEXT_STEPS.md` for detailed troubleshooting.
