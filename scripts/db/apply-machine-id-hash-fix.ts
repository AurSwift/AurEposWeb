/**
 * Apply Machine ID Hash Length Fix Migration
 * 
 * This script fixes the machine_id_hash column length from varchar(64) to varchar(128)
 * to accommodate the MF2-{SHA256} format which is 68+ characters
 * Run with: tsx -r dotenv/config scripts/db/apply-machine-id-hash-fix.ts dotenv_config_path=.env.local
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
      "0002_fix_machine_id_hash_length.sql"
    );
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("🚀 Applying migration...");
    console.log("Migration SQL:");
    console.log(migrationSQL);

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--") && !s.includes("statement-breakpoint"));

    for (const statement of statements) {
      if (statement.trim().length === 0) continue;
      console.log(`\n📌 Executing: ${statement.substring(0, 80)}...`);
      await client.unsafe(statement + ";");
    }

    console.log("\n✅ Migration applied successfully!");
    console.log("\n📊 Summary of changes:");
    console.log("  - Updated terminal_sessions.machine_id_hash from varchar(64) to varchar(128)");
    console.log("  - Updated terminal_coordination_events.machine_id_hash from varchar(64) to varchar(128)");
    console.log("\n🎯 This fixes the 'value too long for type character varying(64)' error");
    console.log("   Terminal sessions should now register successfully!");
  } catch (error) {
    console.error("\n❌ Migration failed:");
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
