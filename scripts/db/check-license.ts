/**
 * Quick script to check license keys in the database
 */
import { db } from "../../lib/db";
import { licenseKeys, activations } from "../../lib/db/schema";
import { eq, like } from "drizzle-orm";

async function checkLicense() {
  const targetLicenseKey = "AUR-BAS-V2-F68343BA-F4EBA9A1";

  console.log("\n=== Checking License Key ===");
  console.log(`Looking for: ${targetLicenseKey}`);

  // Check exact match
  const exactMatch = await db
    .select()
    .from(licenseKeys)
    .where(eq(licenseKeys.licenseKey, targetLicenseKey));

  console.log(`\nExact match results: ${exactMatch.length}`);
  if (exactMatch.length > 0) {
    console.log(JSON.stringify(exactMatch, null, 2));
  }

  // Check case-insensitive / partial match
  const partialMatch = await db
    .select()
    .from(licenseKeys)
    .where(like(licenseKeys.licenseKey, "%F68343BA%"));

  console.log(`\nPartial match (F68343BA): ${partialMatch.length}`);
  if (partialMatch.length > 0) {
    console.log(JSON.stringify(partialMatch, null, 2));
  }

  // List all license keys
  const allLicenses = await db.select().from(licenseKeys).limit(10);
  console.log(`\n=== All License Keys (first 10) ===`);
  allLicenses.forEach((l, i) => {
    console.log(
      `${i + 1}. ${l.licenseKey} | isActive: ${l.isActive} | maxTerminals: ${l.maxTerminals}`
    );
  });

  // Check activations
  console.log(`\n=== Activations for target license ===`);
  const activationsForLicense = await db
    .select()
    .from(activations)
    .where(eq(activations.licenseKey, targetLicenseKey));

  console.log(`Found ${activationsForLicense.length} activations`);
  if (activationsForLicense.length > 0) {
    activationsForLicense.forEach((a, i) => {
      console.log(
        `${i + 1}. machineIdHash: ${a.machineIdHash?.substring(
          0,
          30
        )}... | isActive: ${a.isActive}`
      );
    });
  }

  process.exit(0);
}

checkLicense().catch(console.error);
