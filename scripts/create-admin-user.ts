/**
 * Create Admin User Script
 *
 * This script creates an admin user in the database
 * Run with: npm run admin:create <email> <name> <password>
 *
 * Usage:
 *   npm run admin:create admin@example.com "Admin Name" "password123"
 */

import { createUser } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function createAdminUser() {
  const [email, name, password] = process.argv.slice(2);

  if (!email || !name || !password) {
    console.error("❌ Usage: npm run admin:create <email> <name> <password>");
    console.error("\nExample:");
    console.error(
      '  npm run admin:create admin@auraswift.com "Admin User" "SecurePass123"'
    );
    console.error("\n💡 Note: This creates an ADMIN user (full access)");
    console.error("   For startup: Make all team members admins");
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
    console.log(`🔑 Role: admin (full access)`);

    const user = await createUser(email, password, name, "admin");

    // Auto-verify email for admin users (manual creation)
    await db
      .update(users)
      .set({ emailVerified: new Date() })
      .where(eq(users.id, user.id));

    console.log("\n✅ Admin user created successfully!");
    console.log(`\n📊 User Details:`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Email Verified: ✅ (auto-verified)`);
    console.log(`\n🔐 You can now log in with this account.`);
    console.log(`\n🎯 Startup tip:`);
    console.log(`  - Make all founders/team members admins`);
    console.log(`  - Use only 'admin' role for your team for now`);
    console.log(`  - Customers get 'customer' role automatically on signup`);
  } catch (error) {
    console.error("\n❌ Failed to create admin user:");
    if (error instanceof Error) {
      console.error(error.message);
      if (error.message.includes("duplicate")) {
        console.error("\n💡 This email already exists in the database");
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

createAdminUser();
