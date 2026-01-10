/**
 * Migration Script for Phase 5 & 6
 * Run this to create analytics and terminal coordination tables
 */

import { sql as rawSql } from "drizzle-orm";
import { db } from "../lib/db/index.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  console.log("🚀 Starting Phase 5 & 6 migration...");

  try {
    // Read SQL file
    const sqlFilePath = path.join(
      __dirname,
      "../drizzle/manual_phase5_6_analytics_coordination.sql"
    );
    const sqlContent = fs.readFileSync(sqlFilePath, "utf-8");

    // Execute SQL using drizzle
    await db.execute(rawSql.raw(sqlContent));

    console.log("✅ Phase 5 & 6 migration completed successfully!");
    console.log("");
    console.log("Created tables:");
    console.log("  Phase 5 (Advanced Analytics):");
    console.log("    - license_health_metrics");
    console.log("    - failure_patterns");
    console.log("    - performance_metrics");
    console.log("");
    console.log("  Phase 6 (Multi-Terminal Coordination):");
    console.log("    - terminal_sessions");
    console.log("    - terminal_state_sync");
    console.log("    - terminal_coordination_events");
    console.log("");
    console.log("All indexes created successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    process.exit(0);
  }
}

// Run migration
migrate()
  .then(() => {
    console.log("Migration completed");
  })
  .catch((error) => {
    console.error("Migration error:", error);
    process.exit(1);
  });
