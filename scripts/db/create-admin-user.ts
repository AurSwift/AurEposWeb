/**
 * Create Admin User Script
 * 
 * This script creates an admin user in the database
 * Run with: npx tsx scripts/create-admin-user.ts
 * 
 * Usage:
 *   npx tsx scripts/create-admin-user.ts admin@example.com "Admin Name" "password123"
 */

import { createUser } from "@/lib/auth-utils";

async function createAdminUser() {
  const [email, name, password] = process.argv.slice(2);

  if (!email || !name || !password) {
    console.error("❌ Usage: npx tsx scripts/create-admin-user.ts <email> <name> <password>");
    console.error("\nExample:");
    console.error('  npx tsx scripts/create-admin-user.ts admin@auraswift.com "Admin User" "SecurePass123"');
    process.exit(1);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error("❌ Invalid email format");
    process.exit(1);
  }

  // Validate password strength
  if (password.length < 8) {
    console.error("❌ Password must be at least 8 characters long");
    process.exit(1);
  }

  try {
    console.log("🔄 Creating admin user...");
    console.log(`📧 Email: ${email}`);
    console.log(`👤 Name: ${name}`);
    console.log(`🔑 Role: admin`);

    const user = await createUser(email, password, name, "admin");

    console.log("\n✅ Admin user created successfully!");
    console.log(`\n📊 User Details:`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Role: ${user.role}`);
    console.log(`\n⚠️  Note: Email verification is required before login.`);
    console.log(`  Update emailVerified manually or implement email verification.`);
  } catch (error) {
    console.error("\n❌ Failed to create admin user:");
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

createAdminUser();

