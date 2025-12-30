/**
 * Seed script to create demo user in the database
 * Run with: pnpm tsx scripts/seed-demo-user.ts
 */

import { db } from "../lib/db";
import { users, customers, subscriptions, licenseKeys } from "../lib/db/schema";
import { hashPassword } from "../lib/auth-utils";
import { eq } from "drizzle-orm";
import { generateLicenseKey } from "../lib/license/generator";

async function seedDemoUser() {
  try {
    console.log("Seeding demo user...");

    // Check if demo user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, "demo@company.com"))
      .limit(1);

    if (existingUser.length > 0) {
      console.log("Demo user already exists!");
      return;
    }

    // Create user
    const hashedPassword = await hashPassword("demo123");
    const [user] = await db
      .insert(users)
      .values({
        email: "demo@company.com",
        password: hashedPassword,
        name: "Acme Retail Co.",
      })
      .returning();

    console.log("Created user:", user.id);

    // Create customer linked to user
    const [customer] = await db
      .insert(customers)
      .values({
        userId: user.id, // Link user to customer (one-to-one)
        email: "demo@company.com",
        companyName: "Acme Retail Co.",
        status: "active",
      })
      .returning();

    console.log("Created customer:", customer.id);

    // Create subscription
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

    const [subscription] = await db
      .insert(subscriptions)
      .values({
        customerId: customer.id,
        planId: "professional",
        planType: "professional", // Keep for backward compatibility
        billingCycle: "monthly",
        price: "99.00",
        status: "active",
        currentPeriodStart,
        currentPeriodEnd,
        nextBillingDate: currentPeriodEnd,
        autoRenew: true,
        quantity: 1,
      })
      .returning();

    console.log("Created subscription:", subscription.id);

    // Generate and create license key with proper format
    const generatedLicenseKey = generateLicenseKey("professional", customer.id);
    const [licenseKey] = await db
      .insert(licenseKeys)
      .values({
        customerId: customer.id,
        subscriptionId: subscription.id,
        licenseKey: generatedLicenseKey,
        maxTerminals: 5,
        activationCount: 0,
        version: "2.0",
        issuedAt: new Date(),
        isActive: true,
      })
      .returning();

    console.log("Created license key:", licenseKey.licenseKey);

    console.log("\n✅ Demo user seeded successfully!");
    console.log("Email: demo@company.com");
    console.log("Password: demo123");
  } catch (error) {
    console.error("Error seeding demo user:", error);
    process.exit(1);
  }
}

seedDemoUser();
