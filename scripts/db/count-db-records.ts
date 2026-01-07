/**
 * Database Record Counter Script
 *
 * This script displays the count of records in all database tables.
 * Useful for monitoring database state without any risk of data modification.
 *
 * Usage:
 *   pnpm count:db                  # Show all table counts
 *   pnpm count:db --json           # Output as JSON
 *   pnpm count:db --table=users    # Count specific table only
 *
 * Run with: pnpm tsx scripts/count-db-records.ts
 */

// Load environment variables FIRST before any other imports
import { config } from "dotenv";
config({ path: ".env.local" });

// Now import after env is loaded
import { db } from "../../lib/db";
import {
  users,
  customers,
  subscriptions,
  licenseKeys,
  activations,
  payments,
  subscriptionChanges,
  supportTickets,
  webhookEvents,
  accounts,
  sessions,
  verificationTokens,
  passwordResetTokens,
} from "../../lib/db/schema";
import { sql } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

interface TableCount {
  tableName: string;
  count: number;
  category: "business" | "auth" | "audit";
}

interface CountOptions {
  json: boolean;
  table?: string;
  showEmpty: boolean;
  byCategory: boolean;
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArguments(): CountOptions {
  const args = process.argv.slice(2);
  const options: CountOptions = {
    json: false,
    table: undefined,
    showEmpty: true,
    byCategory: false,
  };

  for (const arg of args) {
    if (arg === "--json") {
      options.json = true;
    } else if (arg.startsWith("--table=")) {
      options.table = arg.split("=")[1].replace(/['"]/g, "");
    } else if (arg === "--hide-empty") {
      options.showEmpty = false;
    } else if (arg === "--by-category") {
      options.byCategory = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Database Record Counter

Usage:
  pnpm count:db [options]

Options:
  --json                Show output as JSON
  --table=<name>        Count specific table only
  --hide-empty          Hide tables with 0 records
  --by-category         Group tables by category
  -h, --help            Show this help message

Examples:
  pnpm count:db                      # Show all table counts
  pnpm count:db --json               # Output as JSON
  pnpm count:db --table=users        # Count only users table
  pnpm count:db --hide-empty         # Hide empty tables
  pnpm count:db --by-category        # Group by category
  `);
}

// ============================================================================
// Counting Functions
// ============================================================================

async function countTable(tableName: string): Promise<number> {
  const tableMap = {
    users,
    customers,
    subscriptions,
    licenseKeys,
    activations,
    payments,
    subscriptionChanges,
    supportTickets,
    webhookEvents,
    accounts,
    sessions,
    verificationTokens,
    passwordResetTokens,
  } as const;

  type TableName = keyof typeof tableMap;

  if (!(tableName in tableMap)) {
    throw new Error(`Unknown table: ${tableName}`);
  }

  const table = tableMap[tableName as TableName];
  const result = await db.select({ count: sql<number>`count(*)` }).from(table);
  return Number(result[0].count);
}

async function countAllTables(): Promise<TableCount[]> {
  const tables: TableCount[] = [
    // Business tables
    { tableName: "customers", count: 0, category: "business" },
    { tableName: "subscriptions", count: 0, category: "business" },
    { tableName: "licenseKeys", count: 0, category: "business" },
    { tableName: "activations", count: 0, category: "business" },
    { tableName: "payments", count: 0, category: "business" },
    { tableName: "supportTickets", count: 0, category: "business" },

    // Auth tables
    { tableName: "users", count: 0, category: "auth" },
    { tableName: "accounts", count: 0, category: "auth" },
    { tableName: "sessions", count: 0, category: "auth" },
    { tableName: "verificationTokens", count: 0, category: "auth" },
    { tableName: "passwordResetTokens", count: 0, category: "auth" },

    // Audit tables
    { tableName: "subscriptionChanges", count: 0, category: "audit" },
    { tableName: "webhookEvents", count: 0, category: "audit" },
  ];

  // Count all tables in parallel for speed
  await Promise.all(
    tables.map(async (table) => {
      table.count = await countTable(table.tableName);
    })
  );

  return tables;
}

async function getUserBreakdown(): Promise<{ role: string; count: number }[]> {
  try {
    const result = await db
      .select({
        role: users.role,
        count: sql<number>`count(*)`,
      })
      .from(users)
      .groupBy(users.role);

    return result.map((r) => ({
      role: r.role || "unknown",
      count: Number(r.count),
    }));
  } catch {
    // Column might not exist in database yet
    return [];
  }
}

async function getSubscriptionBreakdown(): Promise<
  { status: string; count: number }[]
> {
  try {
    const result = await db
      .select({
        status: subscriptions.status,
        count: sql<number>`count(*)`,
      })
      .from(subscriptions)
      .groupBy(subscriptions.status);

    return result.map((r) => ({
      status: r.status || "unknown",
      count: Number(r.count),
    }));
  } catch {
    // Column might not exist in database yet
    return [];
  }
}

// ============================================================================
// Display Functions
// ============================================================================

function displayTableCounts(tables: TableCount[], options: CountOptions) {
  let filteredTables = tables;

  if (!options.showEmpty) {
    filteredTables = tables.filter((t) => t.count > 0);
  }

  if (options.byCategory) {
    displayByCategory(filteredTables);
  } else {
    displaySimpleList(filteredTables);
  }
}

function displaySimpleList(tables: TableCount[]) {
  console.log("\n📊 Database Record Counts");
  console.log("═".repeat(65));
  console.log(
    `${"Table Name".padEnd(30)} ${"Records".padStart(12)} ${"Category".padStart(
      15
    )}`
  );
  console.log("─".repeat(65));

  let totalRecords = 0;
  tables.forEach((table) => {
    const categoryIcon = getCategoryIcon(table.category);
    console.log(
      `${table.tableName.padEnd(30)} ${String(table.count).padStart(12)} ${(
        categoryIcon +
        " " +
        table.category
      ).padStart(15)}`
    );
    totalRecords += table.count;
  });

  console.log("═".repeat(65));
  console.log(`${"TOTAL".padEnd(30)} ${String(totalRecords).padStart(12)}`);
  console.log("═".repeat(65));
}

function displayByCategory(tables: TableCount[]) {
  const categories: Record<string, TableCount[]> = {
    business: [],
    auth: [],
    audit: [],
  };

  tables.forEach((table) => {
    categories[table.category].push(table);
  });

  console.log("\n📊 Database Record Counts (by Category)");
  console.log("═".repeat(55));

  Object.entries(categories).forEach(([category, categoryTables]) => {
    if (categoryTables.length === 0) return;

    const categoryTotal = categoryTables.reduce((sum, t) => sum + t.count, 0);
    const icon = getCategoryIcon(category);

    console.log(
      `\n${icon} ${category.toUpperCase()} (${categoryTotal} records)`
    );
    console.log("─".repeat(55));

    categoryTables.forEach((table) => {
      console.log(
        `   ${table.tableName.padEnd(35)} ${String(table.count).padStart(10)}`
      );
    });
  });

  const totalRecords = tables.reduce((sum, t) => sum + t.count, 0);
  console.log("\n═".repeat(55));
  console.log(`${"TOTAL".padEnd(40)} ${String(totalRecords).padStart(10)}`);
  console.log("═".repeat(55));
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    business: "💼",
    auth: "🔐",
    audit: "📝",
  };
  return icons[category] || "📊";
}

async function displayDetailedStats() {
  console.log("\n📈 Detailed Statistics");
  console.log("─".repeat(55));

  // User breakdown
  const userBreakdown = await getUserBreakdown();
  if (userBreakdown.length > 0) {
    console.log("\n👥 Users by Role:");
    userBreakdown.forEach((item) => {
      console.log(
        `   ${item.role.padEnd(20)} ${String(item.count).padStart(10)}`
      );
    });
  }

  // Subscription breakdown
  const subBreakdown = await getSubscriptionBreakdown();
  if (subBreakdown.length > 0) {
    console.log("\n📦 Subscriptions by Status:");
    subBreakdown.forEach((item) => {
      console.log(
        `   ${item.status.padEnd(20)} ${String(item.count).padStart(10)}`
      );
    });
  }

  console.log("");
}

// ============================================================================
// JSON Output
// ============================================================================

function displayAsJson(tables: TableCount[]) {
  const output = {
    timestamp: new Date().toISOString(),
    databaseUrl: process.env.DATABASE_URL?.split("@")[1] || "unknown",
    tables: tables.map((t) => ({
      name: t.tableName,
      count: t.count,
      category: t.category,
    })),
    totals: {
      allTables: tables.reduce((sum, t) => sum + t.count, 0),
      business: tables
        .filter((t) => t.category === "business")
        .reduce((sum, t) => sum + t.count, 0),
      auth: tables
        .filter((t) => t.category === "auth")
        .reduce((sum, t) => sum + t.count, 0),
      audit: tables
        .filter((t) => t.category === "audit")
        .reduce((sum, t) => sum + t.count, 0),
    },
  };

  console.log(JSON.stringify(output, null, 2));
}

// ============================================================================
// Main Function
// ============================================================================

async function main() {
  const options = parseArguments();

  if (options.json) {
    // JSON output mode - no fancy formatting
    if (options.table) {
      const count = await countTable(options.table);
      console.log(JSON.stringify({ table: options.table, count }, null, 2));
    } else {
      const tables = await countAllTables();
      displayAsJson(tables);
    }
    return;
  }

  // Regular display mode
  console.log("\n╔═══════════════════════════════════════════════════════╗");
  console.log("║          DATABASE RECORD COUNTER                      ║");
  console.log("╚═══════════════════════════════════════════════════════╝");

  if (options.table) {
    // Single table mode
    const count = await countTable(options.table);
    console.log(`\n📊 Table: ${options.table}`);
    console.log(`   Records: ${count}`);
  } else {
    // All tables mode
    const tables = await countAllTables();
    displayTableCounts(tables, options);

    // Show detailed stats if any data exists
    const hasData = tables.some((t) => t.count > 0);
    if (hasData) {
      await displayDetailedStats();
    }
  }

  console.log("\n✨ Done!");
}

// ============================================================================
// Execute
// ============================================================================

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n💥 Error:", error);
    process.exit(1);
  });
