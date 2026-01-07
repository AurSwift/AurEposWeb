/**
 * Apply Employees Table Migration
 * 
 * This script applies the employees table migration to the database
 * Run with: npx tsx scripts/apply-employees-migration.ts
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
      "0006_add_employees_table.sql"
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
    console.log("  - Created 'employees' table");
    console.log("  - Added foreign key to users table");
    console.log("  - Created indexes on user_id, department, and is_active");
    console.log("\n🎯 Purpose:");
    console.log("  - Track internal team members (admin, support, developer)");
    console.log("  - Store department, job title, and permissions");
    console.log("  - Separate employee data from customer data");
    console.log("\n📝 Next steps:");
    console.log("  1. Optionally create employee records for existing internal users");
    console.log("  2. Use this table to track employee-specific information");
    console.log("  3. Link support tickets and admin actions to employees");
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

