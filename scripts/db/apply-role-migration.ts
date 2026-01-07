/**
 * Apply User Role Migration
 * 
 * This script applies the role field migration to the database
 * Run with: npx tsx scripts/apply-role-migration.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

async function applyMigration() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  console.log("🔄 Connecting to database...");
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  try {
    console.log("📝 Reading migration file...");
    const migrationPath = join(
      process.cwd(),
      "drizzle",
      "0005_add_user_roles.sql"
    );
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("🚀 Applying migration...");
    console.log("Migration SQL:");
    console.log(migrationSQL);

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      console.log(`\n📌 Executing: ${statement.substring(0, 60)}...`);
      await client.unsafe(statement);
    }

    console.log("\n✅ Migration applied successfully!");
    console.log("\n📊 Summary of changes:");
    console.log("  - Added 'role' column to users table (default: 'customer')");
    console.log("  - Added foreign key constraint to support_tickets.responded_by");
    console.log("  - Created index on users.role");
    console.log("  - Created index on support_tickets.responded_by");
    console.log("\n🎯 Next steps:");
    console.log("  1. All existing users now have role='customer'");
    console.log("  2. Create admin users manually or via admin creation endpoint");
    console.log("  3. Update your API routes to use role-based middleware");
  } catch (error) {
    console.error("\n❌ Migration failed:");
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    console.log("\n🔌 Database connection closed");
  }
}

applyMigration();

