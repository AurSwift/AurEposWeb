/**
 * Script to add planId metadata to Stripe products
 * Run with: npx tsx scripts/fix-stripe-metadata.ts
 */

// Load environment variables first
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import Stripe from "stripe";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, "../../.env.local") });

// Initialize Stripe after loading env
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-12-15.clover",
  typescript: true,
});

async function fixStripeMetadata() {
  try {
    console.log("Fetching products from Stripe...");

    const products = await stripe.products.list({ active: true, limit: 100 });

    console.log(`Found ${products.data.length} active products\n`);

    // Map product names to planIds
    const planMapping: Record<string, string> = {
      basic: "basic",
      professional: "professional",
      pro: "professional", // Sometimes called "Pro"
    };

    for (const product of products.data) {
      const productName = product.name.toLowerCase();
      let planId: string | null = null;

      // Check if product already has planId metadata
      if (product.metadata?.planId) {
        console.log(
          `✓ Product "${product.name}" (${product.id}) already has planId: ${product.metadata.planId}`
        );
        continue;
      }

      // Try to determine planId from product name
      for (const [key, value] of Object.entries(planMapping)) {
        if (productName.includes(key)) {
          planId = value;
          break;
        }
      }

      if (planId) {
        console.log(
          `Updating product "${product.name}" (${product.id}) with planId: ${planId}...`
        );

        await stripe.products.update(product.id, {
          metadata: {
            ...product.metadata,
            planId,
          },
        });

        console.log(`✓ Updated successfully\n`);
      } else {
        console.log(
          `⚠ Could not determine planId for product "${product.name}" (${product.id})`
        );
        console.log(
          `  Please manually update this product in Stripe Dashboard with metadata: planId = basic|professional\n`
        );
      }
    }

    console.log(
      "\n✅ Done! Please restart your dev server to clear the cache."
    );
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

fixStripeMetadata();
