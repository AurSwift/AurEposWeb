# Stripe Plans Setup Guide

This document explains how to set up plans in Stripe to work with the aurswift application.

## Overview

The application now fetches all plan information (prices, names, descriptions) directly from Stripe, making Stripe the single source of truth for pricing. Plan features remain hardcoded in the application as they represent business logic.

## Stripe Product Setup

### Required Products

You need to create 3 products in Stripe, one for each plan:

1. **Basic Plan** - `metadata.planId = "basic"`
2. **Professional Plan** - `metadata.planId = "professional"`
3. **Enterprise Plan** - `metadata.planId = "enterprise"`

### Product Configuration

For each product:

1. **Product Name**: The name displayed on the pricing page (e.g., "Basic", "Professional", "Enterprise")
2. **Product Description**: The description shown on the pricing page
3. **Metadata**: Add the following metadata fields:
   - **`planId`**: One of `basic`, `professional`, or `enterprise` (required)
   - **`popular`**: Set to `true` to mark as "Most Popular" (optional)
   - **`features`**: JSON string with plan features (optional, see below)

#### Features Configuration (Optional but Recommended)

For best practices, store plan features in Stripe product metadata. This makes Stripe the single source of truth for both pricing AND features.

**Format**: Add a metadata field with key `features` and value as a JSON string:

```json
{
  "maxTerminals": 1,
  "features": [
    "Single terminal",
    "Basic inventory management",
    "Sales reporting",
    "Email support (48hr response)"
  ],
  "limits": {
    "users": 1,
    "storage": "5GB",
    "apiAccess": false,
    "support": "email"
  }
}
```

**If features are not in Stripe metadata**, the system will use hardcoded defaults from the codebase. This ensures the system works even if metadata is not configured, but for best practices, store features in Stripe.

### Price Configuration

Each product must have **exactly 2 prices**:

1. **Monthly Price**:

   - Recurring interval: `month`
   - Price amount: Set in cents (e.g., $49/month = 4900 cents)

2. **Annual Price**:
   - Recurring interval: `year`
   - Price amount: Set in cents (e.g., $470/year = 47000 cents)

### Example Setup

#### Basic Plan Product

- **Name**: "Basic"
- **Description**: "Perfect for small businesses"
- **Metadata**: `planId = "basic"`
- **Monthly Price**: $49/month (4900 cents, recurring monthly)
- **Annual Price**: $470/year (47000 cents, recurring yearly)

#### Professional Plan Product

- **Name**: "Professional"
- **Description**: "For growing businesses"
- **Metadata**: `planId = "professional"`
- **Monthly Price**: $99/month (9900 cents, recurring monthly)
- **Annual Price**: $950/year (95000 cents, recurring yearly)

#### Enterprise Plan Product

- **Name**: "Enterprise"
- **Description**: "For large organizations"
- **Metadata**: `planId = "enterprise"`
- **Monthly Price**: $299/month (29900 cents, recurring monthly)
- **Annual Price**: $2870/year (287000 cents, recurring yearly)

## How It Works

1. **Caching**: Plans are cached in memory for 15 minutes to reduce Stripe API calls
2. **Automatic Updates**: When you update prices, names, descriptions, or features in Stripe, they automatically reflect on the website (after cache expires)
3. **Error Handling**: If Stripe is unavailable, the system uses cached data or returns an error
4. **Features**:
   - **Best Practice**: Store features in Stripe product metadata (`metadata.features` as JSON)
   - **Fallback**: If features are not in Stripe, hardcoded defaults from the codebase are used
   - This ensures the system works even if metadata is not configured, but Stripe is the recommended single source of truth

## Environment Variables

No environment variables are needed for Price IDs anymore! The system automatically discovers prices by:

1. Fetching all active products
2. Filtering by `metadata.planId`
3. Finding monthly and annual prices for each product

## Testing

To test the setup:

1. Ensure all 3 products exist in Stripe with correct metadata
2. Ensure each product has both monthly and annual prices
3. Call `/api/subscriptions/plans` endpoint - it should return all plans with prices from Stripe
4. Check the browser console for any warnings about missing plans

## Troubleshooting

### "Missing required plans in Stripe" error

- Ensure all 3 products exist with `metadata.planId` set correctly
- Ensure products are marked as "Active" in Stripe

### "Missing monthly or annual price" warning

- Ensure each product has exactly 2 prices: one monthly, one annual
- Ensure prices are marked as "Active" in Stripe
- Ensure recurring interval is set correctly (`month` or `year`)

### Prices not updating

- Wait for cache to expire (15 minutes) or restart the server
- Check that prices are active in Stripe
- Verify product metadata is correct

## Cache Management

To manually clear the cache (useful for testing):

```typescript
import { clearPlansCache } from "@/lib/stripe/plans";
clearPlansCache();
```
