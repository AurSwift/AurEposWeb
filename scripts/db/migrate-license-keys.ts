/**
 * Migration script to update old license keys to new format
 * Old format: AURA-XXXXXX-XXXXXX-XXXXXX
 * New format: AUR-{PLAN}-V2-{8chars}-{checksum}
 * 
 * Run with: pnpm tsx scripts/migrate-license-keys.ts
 */

import { db } from "../../lib/db";
import { licenseKeys, subscriptions } from "../../lib/db/schema";
import { eq } from "drizzle-orm";
import { generateLicenseKey } from "../../lib/license/generator";
import type { PlanId } from "../../lib/stripe/plans";

async function migrateLicenseKeys() {
  console.log("\n🔄 Starting license key migration...\n");

  try {
    // Get all license keys
    const allLicenses = await db.select().from(licenseKeys);

    console.log(`Found ${allLicenses.length} license keys to check\n`);

    let updatedCount = 0;

    for (const license of allLicenses) {
      // Check if it's old format (starts with AURA- not AUR-)
      if (license.licenseKey.startsWith("AURA-") && !license.licenseKey.includes("-V2-")) {
        console.log(`❌ Old format: ${license.licenseKey}`);

        // Get subscription to determine plan
        if (!license.subscriptionId) {
          console.log(`   ⚠️  No subscription ID, skipping...`);
          continue;
        }
        const [subscription] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, license.subscriptionId))
          .limit(1);

        if (!subscription) {
          console.log(`   ⚠️  No subscription found, skipping...`);
          continue;
        }

        // Determine plan from max terminals (basic=1, professional=5)
        let planId: PlanId = "professional"; // default
        if (license.maxTerminals === 1) {
          planId = "basic";
        } else {
          planId = "professional";
        }

        // Generate new license key
        const newLicenseKey = generateLicenseKey(planId, license.customerId);

        // Update in database
        await db
          .update(licenseKeys)
          .set({
            licenseKey: newLicenseKey,
            version: "2.0",
          })
          .where(eq(licenseKeys.id, license.id));

        console.log(`   ✅ New format: ${newLicenseKey}\n`);
        updatedCount++;
      } else {
        console.log(`✅ Already new format: ${license.licenseKey}`);
      }
    }

    console.log(`\n✅ Migration complete! Updated ${updatedCount} license keys.\n`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrateLicenseKeys();
