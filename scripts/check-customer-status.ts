/**
 * Check the status of a specific customer
 */

import { db } from "@/lib/db";
import { customers, subscriptions, licenseKeys } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const customerId = "5c421f46-1bcb-4e85-bf00-a52c16c2df04";

async function checkCustomerStatus() {
  console.log(`🔍 Checking customer: ${customerId}\n`);

  // Get customer
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);

  if (!customer) {
    console.log("❌ Customer not found in database");
    return;
  }

  console.log("📋 Customer Details:");
  console.log("━".repeat(80));
  console.log(`ID: ${customer.id}`);
  console.log(`Email: ${customer.email}`);
  console.log(`Company: ${customer.companyName || "N/A"}`);
  console.log(`Status: ${customer.status} ${customer.status === "deleted" ? "✅" : "❌"}`);
  console.log(`Stripe Customer ID: ${customer.stripeCustomerId || "(unlinked)"}`);
  console.log(`Created: ${customer.createdAt.toISOString()}`);
  console.log(`Updated: ${customer.updatedAt.toISOString()}`);
  console.log("");

  // Get subscriptions
  const subs = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.customerId, customerId));

  console.log(`📦 Subscriptions (${subs.length}):`);
  if (subs.length === 0) {
    console.log("  No subscriptions found");
  } else {
    subs.forEach((sub, idx) => {
      console.log(`  ${idx + 1}. ID: ${sub.id}`);
      console.log(`     Status: ${sub.status}`);
      console.log(`     Plan: ${sub.planId}`);
      console.log(`     Stripe Sub ID: ${sub.stripeSubscriptionId}`);
    });
  }
  console.log("");

  // Get license keys
  const licenses = await db
    .select()
    .from(licenseKeys)
    .where(eq(licenseKeys.customerId, customerId));

  console.log(`🔑 License Keys (${licenses.length}):`);
  if (licenses.length === 0) {
    console.log("  No license keys found");
  } else {
    licenses.forEach((lic, idx) => {
      console.log(`  ${idx + 1}. Key: ${lic.licenseKey.substring(0, 20)}...`);
      console.log(`     Active: ${lic.isActive ? "Yes ❌" : "No ✅"}`);
      console.log(`     Revoked: ${lic.revokedAt ? "Yes ✅" : "No ❌"}`);
      console.log(`     Reason: ${lic.revocationReason || "N/A"}`);
    });
  }
  console.log("");

  console.log("━".repeat(80));
  console.log("\n📊 Summary:");
  
  const isProperlyDeleted = 
    customer.status === "deleted" &&
    customer.stripeCustomerId === null &&
    subs.every(s => s.status === "cancelled") &&
    licenses.every(l => !l.isActive && l.revokedAt !== null);

  if (isProperlyDeleted) {
    console.log("✅ Customer is properly soft-deleted:");
    console.log("   • Status set to 'deleted'");
    console.log("   • Stripe customer ID unlinked");
    console.log("   • All subscriptions cancelled");
    console.log("   • All license keys revoked");
    console.log("\n💡 Note: This is a SOFT DELETE - the record still exists in the database");
    console.log("   for audit/history purposes, but the customer is effectively deleted.");
  } else {
    console.log("❌ Customer was NOT properly deleted:");
    if (customer.status !== "deleted") {
      console.log(`   • Status is '${customer.status}' (expected 'deleted')`);
    }
    if (customer.stripeCustomerId !== null) {
      console.log(`   • Stripe customer ID still linked: ${customer.stripeCustomerId}`);
    }
    if (!subs.every(s => s.status === "cancelled")) {
      console.log("   • Some subscriptions are not cancelled");
    }
    if (!licenses.every(l => !l.isActive)) {
      console.log("   • Some license keys are still active");
    }
  }
}

checkCustomerStatus()
  .then(() => {
    console.log("\n✅ Check complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Check failed:", error);
    process.exit(1);
  });

