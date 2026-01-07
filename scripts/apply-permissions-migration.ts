/**
 * Apply Permissions System Migration
 * 
 * This script applies the permissions system migration to the database
 * Run with: npm run db:apply-permissions
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
      "0007_add_permissions_system.sql"
    );
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("🚀 Applying migration...");

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
    console.log("  - Created 'permissions' table");
    console.log("  - Created 'role_permissions' junction table");
    console.log("  - Created 'user_permissions' table (optional custom permissions)");
    console.log("  - Created indexes for performance");
    
    console.log("\n🎯 Purpose:");
    console.log("  - Granular permission-based access control");
    console.log("  - Map permissions to roles (customer, admin, support, developer)");
    console.log("  - Optionally grant custom permissions to specific users");
    
    console.log("\n📝 Next steps:");
    console.log("  1. Run: npm run db:seed-permissions");
    console.log("     This populates the permissions and maps them to roles");
    console.log("  2. Your admin users will have ALL permissions automatically");
    console.log("  3. Customers will have limited permissions (own data only)");
    
    console.log("\n💡 Startup Note:");
    console.log("  - Admin gets ALL permissions (no need to map)");
    console.log("  - Customer gets limited permissions (read/write own data)");
    console.log("  - Support/Developer permissions are ready when you hire");
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

