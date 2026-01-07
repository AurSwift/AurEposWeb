/**
 * Drop All Database Tables Script
 * 
 * ⚠️  EXTREMELY DESTRUCTIVE - This script drops ALL tables from the database!
 * 
 * This completely removes all table structures and data.
 * Use this when you need to reset the database schema completely.
 * 
 * Common use cases:
 * - Fresh schema migration after major schema changes
 * - Resetting development database to clean state
 * - Fixing corrupted schema migrations
 * 
 * Usage:
 *   pnpm drop:tables                           # Interactive with confirmation
 *   pnpm drop:tables --dry-run                 # Preview what would be dropped
 *   pnpm drop:tables --force                   # Skip confirmation (dangerous!)
 *   pnpm drop:tables --cascade                 # Force drop with CASCADE
 * 
 * After dropping tables, you typically need to run:
 *   pnpm db:push  or  pnpm db:migrate
 * 
 * Run with: pnpm tsx scripts/db/drop-all-tables.ts
 */

// Load environment variables FIRST before any other imports
import { config } from "dotenv";
config({ path: ".env.local" });

// Now import after env is loaded
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as readline from "readline";

// ============================================================================
// Configuration & Types
// ============================================================================

interface DropOptions {
  dryRun: boolean;
  force: boolean;
  cascade: boolean;
  allowProduction: boolean;
}

interface TableInfo {
  tableName: string;
  schemaName: string;
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArguments(): DropOptions {
  const args = process.argv.slice(2);
  const options: DropOptions = {
    dryRun: false,
    force: false,
    cascade: false,
    allowProduction: false,
  };

  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--cascade") {
      options.cascade = true;
    } else if (arg === "--allow-production") {
      options.allowProduction = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
⚠️  DROP ALL TABLES SCRIPT - EXTREMELY DESTRUCTIVE ⚠️

This script completely removes all tables from the database!

Usage:
  pnpm drop:tables [options]

Options:
  --dry-run                Preview what would be dropped (no actual deletion)
  --cascade                Use CASCADE to force drop tables with dependencies
  --force                  Skip confirmation prompt (very dangerous!)
  --allow-production       Allow running on production database
  -h, --help               Show this help message

Examples:
  pnpm drop:tables --dry-run           # Preview what would be dropped
  pnpm drop:tables                     # Interactive drop with confirmation
  pnpm drop:tables --cascade           # Force drop with CASCADE

After dropping tables:
  pnpm db:push                         # Push schema from code
  pnpm db:migrate                      # Or run migrations

WARNING:
  This is EXTREMELY DESTRUCTIVE and cannot be undone!
  All table structures AND data will be permanently deleted!
  ALWAYS backup your database first!
  `);
}

// ============================================================================
// Environment Validation
// ============================================================================

function validateEnvironment(options: DropOptions): void {
  const dbUrl = process.env.DATABASE_URL || "";
  const nodeEnv = process.env.NODE_ENV || "development";

  console.log("\n🔍 Environment Check:");
  console.log(`   NODE_ENV: ${nodeEnv}`);
  console.log(`   DATABASE_URL: ${dbUrl.substring(0, 30)}...`);

  // Check if production
  const isProduction =
    nodeEnv === "production" ||
    dbUrl.includes("production") ||
    dbUrl.includes(".amazonaws.com") ||
    dbUrl.includes("heroku") ||
    dbUrl.includes("render.com") ||
    dbUrl.includes("railway.app") ||
    dbUrl.includes("vercel.com");

  if (isProduction && !options.allowProduction) {
    console.error("\n❌ CRITICAL ERROR: This appears to be a PRODUCTION database!");
    console.error("   Dropping all tables in production is EXTREMELY DANGEROUS!");
    console.error("   If you really want to do this, use --allow-production flag");
    console.error("   (But seriously, DON'T DO THIS in production!)");
    process.exit(1);
  }

  if (isProduction) {
    console.warn("\n⚠️  ⚠️  ⚠️  CRITICAL WARNING ⚠️  ⚠️  ⚠️");
    console.warn("   You are about to DROP ALL TABLES in PRODUCTION!");
    console.warn("   This will DELETE ALL DATA and TABLE STRUCTURES!");
    console.warn("   ⚠️  ⚠️  ⚠️  PROCEED WITH EXTREME CAUTION ⚠️  ⚠️  ⚠️");
  }
}

// ============================================================================
// Database Connection
// ============================================================================

function createConnection() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  return postgres(process.env.DATABASE_URL, {
    prepare: false,
  });
}

// ============================================================================
// Table Discovery
// ============================================================================

async function getAllTables(client: ReturnType<typeof postgres>): Promise<TableInfo[]> {
  console.log("\n🔍 Discovering tables in database...");

  const result = await client<TableInfo[]>`
    SELECT 
      table_name as "tableName",
      table_schema as "schemaName"
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;

  return result;
}

function displayTables(tables: TableInfo[], title: string = "Tables Found") {
  console.log(`\n${title}:`);
  console.log("─".repeat(60));

  if (tables.length === 0) {
    console.log("   No tables found in database.");
  } else {
    tables.forEach((table, index) => {
      console.log(`   ${(index + 1).toString().padStart(2)}. ${table.tableName}`);
    });
  }

  console.log("─".repeat(60));
  console.log(`   TOTAL: ${tables.length} table(s)`);
  console.log("─".repeat(60));
}

// ============================================================================
// User Confirmation
// ============================================================================

async function getUserConfirmation(options: DropOptions, tableCount: number): Promise<boolean> {
  if (options.force) {
    console.log("\n⚠️  Force mode enabled - skipping confirmation");
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log("\n⚠️  ⚠️  ⚠️  CRITICAL WARNING ⚠️  ⚠️  ⚠️");
    console.log(`   This will DROP ${tableCount} table(s) from the database!`);
    console.log("   ALL TABLE STRUCTURES will be permanently deleted!");
    console.log("   ALL DATA will be permanently lost!");
    console.log("   This action CANNOT be undone!");
    console.log("\n   Please ensure you have a backup before proceeding.");
    console.log("\n   Type 'DROP ALL TABLES' to confirm (or anything else to cancel):");

    rl.question("   > ", (answer) => {
      rl.close();
      resolve(answer.trim() === "DROP ALL TABLES");
    });
  });
}

// ============================================================================
// Drop Tables Functions
// ============================================================================

async function dropAllTables(
  client: ReturnType<typeof postgres>,
  tables: TableInfo[],
  options: DropOptions
): Promise<void> {
  const mode = options.dryRun ? "🔍 DRY RUN MODE" : "🗑️  DROPPING TABLES";
  console.log(`\n${mode}`);

  const cascadeClause = options.cascade ? " CASCADE" : "";
  let droppedCount = 0;

  for (const table of tables) {
    try {
      const dropStatement = `DROP TABLE IF EXISTS "${table.schemaName}"."${table.tableName}"${cascadeClause}`;
      
      if (options.dryRun) {
        console.log(`   ✓ Would drop: ${table.tableName}${cascadeClause ? " (CASCADE)" : ""}`);
      } else {
        await client.unsafe(dropStatement);
        console.log(`   ✓ Dropped: ${table.tableName}`);
        droppedCount++;
      }
    } catch (error) {
      console.error(`   ✗ Failed to drop ${table.tableName}:`, error instanceof Error ? error.message : error);
      
      if (!options.cascade) {
        console.log("\n💡 Tip: If tables have foreign key dependencies, try using --cascade flag");
      }
    }
  }

  if (!options.dryRun) {
    console.log(`\n✅ Successfully dropped ${droppedCount} table(s)`);
  }
}

// ============================================================================
// Post-Drop Verification
// ============================================================================

async function verifyTablesDropped(client: ReturnType<typeof postgres>): Promise<void> {
  console.log("\n🔍 Verifying tables were dropped...");
  
  const remainingTables = await getAllTables(client);
  
  if (remainingTables.length === 0) {
    console.log("   ✅ All tables successfully dropped!");
    console.log("   Database schema is now empty.");
  } else {
    console.log(`   ⚠️  Warning: ${remainingTables.length} table(s) still exist:`);
    remainingTables.forEach(table => {
      console.log(`      - ${table.tableName}`);
    });
    console.log("\n   💡 Try running with --cascade flag to force drop these tables");
  }
}

// ============================================================================
// Next Steps Guidance
// ============================================================================

function printNextSteps(options: DropOptions) {
  if (options.dryRun) {
    console.log("\n📋 Next Steps (after confirming dry-run results):");
    console.log("   1. Remove --dry-run flag and run again to actually drop tables");
  } else {
    console.log("\n📋 Next Steps:");
    console.log("   Your database schema is now empty. To recreate it:");
    console.log("\n   Option 1: Push schema from code (recommended for development)");
    console.log("   $ pnpm db:push");
    console.log("\n   Option 2: Run migrations");
    console.log("   $ pnpm db:migrate");
    console.log("\n   Option 3: Seed with demo data");
    console.log("   $ pnpm tsx scripts/db/seed-demo-user.ts");
  }
}

// ============================================================================
// Main Function
// ============================================================================

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║      DROP ALL TABLES - EXTREMELY DESTRUCTIVE SCRIPT        ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const options = parseArguments();

  // Step 1: Validate environment
  validateEnvironment(options);

  // Step 2: Connect to database
  const client = createConnection();

  try {
    // Step 3: Discover tables
    const tables = await getAllTables(client);
    
    if (tables.length === 0) {
      console.log("\n✅ No tables found in database. Nothing to drop!");
      return;
    }

    displayTables(tables, "Tables That Will Be Dropped");

    // Step 4: Show options
    if (options.dryRun) {
      console.log("\n🔍 Running in DRY RUN mode - no tables will be dropped");
    }
    if (options.cascade) {
      console.log("   Using CASCADE - will force drop tables with dependencies");
    }

    // Step 5: Get confirmation (unless dry run or force)
    if (!options.dryRun) {
      const confirmed = await getUserConfirmation(options, tables.length);
      if (!confirmed) {
        console.log("\n❌ Operation cancelled by user");
        await client.end();
        process.exit(0);
      }
    }

    // Step 6: Drop tables
    const startTime = Date.now();
    await dropAllTables(client, tables, options);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n⏱️  Operation completed in ${duration}s`);

    // Step 7: Verify (only if not dry run)
    if (!options.dryRun) {
      await verifyTablesDropped(client);
    }

    // Step 8: Show next steps
    printNextSteps(options);

    console.log("\n✨ Done!");
  } catch (error) {
    console.error("\n💥 Fatal error:", error);
    throw error;
  } finally {
    await client.end();
  }
}

// ============================================================================
// Execute
// ============================================================================

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });

