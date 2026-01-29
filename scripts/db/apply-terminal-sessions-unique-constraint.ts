/**
 * Apply Terminal Sessions Unique Constraint Migration
 *
 * This script:
 * 1. Cleans up duplicate terminal sessions
 * 2. Adds unique constraint on (machine_id_hash, license_key)
 *
 * Run with: tsx -r dotenv/config scripts/db/apply-terminal-sessions-unique-constraint.ts dotenv_config_path=.env.local
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
      "0003_fix_terminal_sessions_unique_constraint.sql"
    );
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("🔍 Checking for duplicate terminal sessions...");
    const duplicates = await client`
      SELECT machine_id_hash, license_key, COUNT(*) as count
      FROM terminal_sessions
      GROUP BY machine_id_hash, license_key
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length > 0) {
      console.log(
        `⚠️  Found ${duplicates.length} duplicate machine+license combinations`
      );
      for (const dup of duplicates) {
        console.log(
          `   - Machine: ${dup.machine_id_hash.substring(
            0,
            20
          )}..., License: ${dup.license_key.substring(0, 20)}..., Count: ${
            dup.count
          }`
        );
      }
    } else {
      console.log("✅ No duplicates found");
    }

    console.log("\n🚀 Applying migration...");
    console.log("Migration SQL:");
    console.log(migrationSQL);

    // Execute the migration SQL
    const statements = migrationSQL
      .split(";")
      .map((s) => s.trim())
      .filter(
        (s) =>
          s.length > 0 &&
          !s.startsWith("--") &&
          !s.includes("Step 1:") &&
          !s.includes("Step 2:") &&
          !s.includes("Step 3:")
      );

    for (const statement of statements) {
      if (statement.trim().length === 0) continue;
      console.log(`\n📌 Executing: ${statement.substring(0, 80)}...`);
      await client.unsafe(statement + ";");
    }

    console.log("\n✅ Migration applied successfully!");
    console.log("\n📊 Summary of changes:");
    console.log("  ✓ Removed duplicate terminal sessions (kept most recent)");
    console.log(
      "  ✓ Added UNIQUE constraint on (machine_id_hash, license_key)"
    );
    console.log("  ✓ Created optimized index for upsert operations");
    console.log("\n🎯 This prevents duplicate terminal sessions!");
    console.log(
      "   Each machine can now have only ONE active session per license."
    );
  } catch (error) {
    console.error("\n❌ Migration failed:");
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
