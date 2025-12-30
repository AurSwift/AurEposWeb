/**
 * Fix script to update incorrect Basic plan prices in the database
 * Run with: pnpm tsx scripts/fix-basic-plan-price.ts
 */

import { db } from "../lib/db";
import { subscriptions } from "../lib/db/schema";
import { eq, and } from "drizzle-orm";

async function fixBasicPlanPrices() {
  try {
    console.log("Fixing Basic plan prices...");

    // Update all Basic plan subscriptions with incorrect price
    const result = await db
      .update(subscriptions)
      .set({
        price: "20.00",
        updatedAt: new Date(),
      })
      .where(
        and(eq(subscriptions.planId, "basic"), eq(subscriptions.price, "49.00"))
      )
      .returning();

    console.log(`✅ Fixed ${result.length} subscription(s)`);

    if (result.length > 0) {
      console.log("\nUpdated subscriptions:");
      result.forEach((sub) => {
        console.log(`  - ID: ${sub.id}, Customer: ${sub.customerId}`);
      });
    }
  } catch (error) {
    console.error("Error fixing prices:", error);
    process.exit(1);
  }
}

fixBasicPlanPrices();
