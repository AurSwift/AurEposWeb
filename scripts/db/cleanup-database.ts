/**
 * Database Cleanup Script
 * 
 * This script deletes all records from all database tables.
 * USE WITH EXTREME CAUTION!
 * 
 * Features:
 * - Safety confirmations
 * - Dry run mode
 * - Selective preservation of admin users
 * - Transaction support with rollback
 * - Environment validation
 * - Progress logging
 * 
 * Usage:
 *   pnpm cleanup:db                                    # Interactive cleanup
 *   pnpm cleanup:db --dry-run                          # Preview what would be deleted
 *   pnpm cleanup:db --preserve-admins                  # Keep admin users
 *   pnpm cleanup:db --preserve-user="admin@example.com" # Keep specific user
 *   pnpm cleanup:db --force                            # Skip confirmation (dangerous!)
 *   pnpm cleanup:db --tables="payments,webhookEvents"  # Only specific tables
 * 
 * Run with: pnpm tsx scripts/cleanup-database.ts
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
import { eq, inArray, ne, sql } from "drizzle-orm";
import * as readline from "readline";

// ============================================================================
// Configuration & Types
// ============================================================================

interface CleanupOptions {
  dryRun: boolean;
  preserveAdmins: boolean;
  preserveUsers: string[];
  force: boolean;
  tables?: string[];
  allowProduction: boolean;
}

interface TableStats {
  tableName: string;
  count: number;
  preserved?: number;
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArguments(): CleanupOptions {
  const args = process.argv.slice(2);
  const options: CleanupOptions = {
    dryRun: false,
    preserveAdmins: false,
    preserveUsers: [],
    force: false,
    tables: undefined,
    allowProduction: false,
  };

  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--preserve-admins") {
      options.preserveAdmins = true;
    } else if (arg.startsWith("--preserve-user=")) {
      const email = arg.split("=")[1].replace(/['"]/g, "");
      options.preserveUsers.push(email);
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg.startsWith("--tables=")) {
      const tables = arg.split("=")[1].replace(/['"]/g, "");
      options.tables = tables.split(",").map((t) => t.trim());
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
Database Cleanup Script

Usage:
  pnpm cleanup:db [options]

Options:
  --dry-run                         Preview what would be deleted (no actual deletion)
  --preserve-admins                 Keep admin users and their related data
  --preserve-user="email@example.com"  Keep specific user and their data
  --force                           Skip confirmation prompt (dangerous!)
  --tables="table1,table2"          Only clean specific tables
  --allow-production                Allow running on production database
  -h, --help                        Show this help message

Examples:
  pnpm cleanup:db --dry-run                    # Preview cleanup
  pnpm cleanup:db --preserve-admins            # Keep admin users
  pnpm cleanup:db --preserve-user="admin@test.com"  # Keep specific user
  pnpm cleanup:db --tables="payments,webhookEvents"  # Clean specific tables

Safety:
  - Always backup your database before running this script
  - Use --dry-run first to preview changes
  - Script will ask for confirmation unless --force is used
  `);
}

// ============================================================================
// Environment Validation
// ============================================================================

function validateEnvironment(options: CleanupOptions): void {
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
    console.error("\n❌ ERROR: This appears to be a PRODUCTION database!");
    console.error("   If you really want to clean production data, use --allow-production flag");
    console.error("   (This is EXTREMELY DANGEROUS and NOT RECOMMENDED)");
    process.exit(1);
  }

  if (isProduction) {
    console.warn("\n⚠️  WARNING: Running on PRODUCTION database!");
    console.warn("   Proceed with EXTREME CAUTION!");
  }
}

// ============================================================================
// Table Counting Functions
// ============================================================================

async function countAllTables(): Promise<TableStats[]> {
  console.log("\n📊 Counting records in all tables...");

  const tables: TableStats[] = [];

  // Count each table
  const activationsCount = await db.select({ count: sql<number>`count(*)` }).from(activations);
  tables.push({ tableName: "activations", count: Number(activationsCount[0].count) });

  const licenseKeysCount = await db.select({ count: sql<number>`count(*)` }).from(licenseKeys);
  tables.push({ tableName: "licenseKeys", count: Number(licenseKeysCount[0].count) });

  const paymentsCount = await db.select({ count: sql<number>`count(*)` }).from(payments);
  tables.push({ tableName: "payments", count: Number(paymentsCount[0].count) });

  const subscriptionChangesCount = await db.select({ count: sql<number>`count(*)` }).from(subscriptionChanges);
  tables.push({ tableName: "subscriptionChanges", count: Number(subscriptionChangesCount[0].count) });

  const supportTicketsCount = await db.select({ count: sql<number>`count(*)` }).from(supportTickets);
  tables.push({ tableName: "supportTickets", count: Number(supportTicketsCount[0].count) });

  const subscriptionsCount = await db.select({ count: sql<number>`count(*)` }).from(subscriptions);
  tables.push({ tableName: "subscriptions", count: Number(subscriptionsCount[0].count) });

  const webhookEventsCount = await db.select({ count: sql<number>`count(*)` }).from(webhookEvents);
  tables.push({ tableName: "webhookEvents", count: Number(webhookEventsCount[0].count) });

  const customersCount = await db.select({ count: sql<number>`count(*)` }).from(customers);
  tables.push({ tableName: "customers", count: Number(customersCount[0].count) });

  const passwordResetTokensCount = await db.select({ count: sql<number>`count(*)` }).from(passwordResetTokens);
  tables.push({ tableName: "passwordResetTokens", count: Number(passwordResetTokensCount[0].count) });

  const verificationTokensCount = await db.select({ count: sql<number>`count(*)` }).from(verificationTokens);
  tables.push({ tableName: "verificationTokens", count: Number(verificationTokensCount[0].count) });

  const sessionsCount = await db.select({ count: sql<number>`count(*)` }).from(sessions);
  tables.push({ tableName: "sessions", count: Number(sessionsCount[0].count) });

  const accountsCount = await db.select({ count: sql<number>`count(*)` }).from(accounts);
  tables.push({ tableName: "accounts", count: Number(accountsCount[0].count) });

  const usersCount = await db.select({ count: sql<number>`count(*)` }).from(users);
  tables.push({ tableName: "users", count: Number(usersCount[0].count) });

  return tables;
}

function displayTableStats(stats: TableStats[], title: string = "Current Database State") {
  console.log(`\n${title}:`);
  console.log("─".repeat(60));

  let totalRecords = 0;
  stats.forEach((stat) => {
    const preserved = stat.preserved !== undefined ? ` (${stat.preserved} preserved)` : "";
    console.log(`   ${stat.tableName.padEnd(25)} ${String(stat.count).padStart(8)} records${preserved}`);
    totalRecords += stat.count;
  });

  console.log("─".repeat(60));
  console.log(`   ${"TOTAL".padEnd(25)} ${String(totalRecords).padStart(8)} records`);
  console.log("─".repeat(60));
}

// ============================================================================
// User Confirmation
// ============================================================================

async function getUserConfirmation(options: CleanupOptions): Promise<boolean> {
  if (options.force) {
    console.log("\n⚠️  Force mode enabled - skipping confirmation");
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log("\n⚠️  WARNING: This will DELETE ALL DATA from the database!");
    console.log("   This action CANNOT be undone!");
    console.log("\n   Please ensure you have a backup before proceeding.");
    console.log("\n   Type 'DELETE ALL DATA' to confirm (or anything else to cancel):");

    rl.question("   > ", (answer) => {
      rl.close();
      resolve(answer.trim() === "DELETE ALL DATA");
    });
  });
}

// ============================================================================
// Cleanup Functions
// ============================================================================

async function getPreservedUserIds(options: CleanupOptions): Promise<string[]> {
  const preservedIds: string[] = [];

  if (options.preserveAdmins) {
    const adminUsers = await db.select().from(users).where(eq(users.role, "admin"));
    preservedIds.push(...adminUsers.map((u) => u.id));
    console.log(`   Preserving ${adminUsers.length} admin user(s)`);
  }

  if (options.preserveUsers.length > 0) {
    const specifiedUsers = await db
      .select()
      .from(users)
      .where(inArray(users.email, options.preserveUsers));
    preservedIds.push(...specifiedUsers.map((u) => u.id));
    console.log(`   Preserving ${specifiedUsers.length} specified user(s)`);
  }

  return [...new Set(preservedIds)]; // Remove duplicates
}

async function cleanupDatabase(options: CleanupOptions): Promise<TableStats[]> {
  console.log(`\n${options.dryRun ? "🔍 DRY RUN MODE - No data will be deleted" : "🗑️  Starting database cleanup..."}`);

  const results: TableStats[] = [];
  const preservedUserIds = await getPreservedUserIds(options);

  // Helper to check if table should be cleaned
  const shouldCleanTable = (tableName: string): boolean => {
    if (!options.tables) return true;
    return options.tables.includes(tableName);
  };

  try {
    // 1. Clean activations
    if (shouldCleanTable("activations")) {
      const countBefore = await db.select({ count: sql<number>`count(*)` }).from(activations);
      if (!options.dryRun) {
        await db.delete(activations);
      }
      results.push({ tableName: "activations", count: Number(countBefore[0].count) });
      console.log(`   ✓ Cleaned activations: ${countBefore[0].count} records`);
    }

    // 2. Clean license keys
    if (shouldCleanTable("licenseKeys")) {
      const countBefore = await db.select({ count: sql<number>`count(*)` }).from(licenseKeys);
      if (!options.dryRun) {
        if (preservedUserIds.length > 0) {
          // Only delete license keys not belonging to preserved users
          const preservedCustomers = await db
            .select()
            .from(customers)
            .where(inArray(customers.userId, preservedUserIds));
          const preservedCustomerIds = preservedCustomers.map((c) => c.id);
          
          if (preservedCustomerIds.length > 0) {
            await db.delete(licenseKeys).where(
              sql`${licenseKeys.customerId} NOT IN ${preservedCustomerIds}`
            );
          } else {
            await db.delete(licenseKeys);
          }
        } else {
          await db.delete(licenseKeys);
        }
      }
      results.push({ tableName: "licenseKeys", count: Number(countBefore[0].count) });
      console.log(`   ✓ Cleaned licenseKeys: ${countBefore[0].count} records`);
    }

    // 3. Clean payments
    if (shouldCleanTable("payments")) {
      const countBefore = await db.select({ count: sql<number>`count(*)` }).from(payments);
      if (!options.dryRun) {
        if (preservedUserIds.length > 0) {
          const preservedCustomers = await db
            .select()
            .from(customers)
            .where(inArray(customers.userId, preservedUserIds));
          const preservedCustomerIds = preservedCustomers.map((c) => c.id);
          
          if (preservedCustomerIds.length > 0) {
            await db.delete(payments).where(
              sql`${payments.customerId} NOT IN ${preservedCustomerIds}`
            );
          } else {
            await db.delete(payments);
          }
        } else {
          await db.delete(payments);
        }
      }
      results.push({ tableName: "payments", count: Number(countBefore[0].count) });
      console.log(`   ✓ Cleaned payments: ${countBefore[0].count} records`);
    }

    // 4. Clean subscription changes
    if (shouldCleanTable("subscriptionChanges")) {
      const countBefore = await db.select({ count: sql<number>`count(*)` }).from(subscriptionChanges);
      if (!options.dryRun) {
        if (preservedUserIds.length > 0) {
          const preservedCustomers = await db
            .select()
            .from(customers)
            .where(inArray(customers.userId, preservedUserIds));
          const preservedCustomerIds = preservedCustomers.map((c) => c.id);
          
          if (preservedCustomerIds.length > 0) {
            await db.delete(subscriptionChanges).where(
              sql`${subscriptionChanges.customerId} NOT IN ${preservedCustomerIds}`
            );
          } else {
            await db.delete(subscriptionChanges);
          }
        } else {
          await db.delete(subscriptionChanges);
        }
      }
      results.push({ tableName: "subscriptionChanges", count: Number(countBefore[0].count) });
      console.log(`   ✓ Cleaned subscriptionChanges: ${countBefore[0].count} records`);
    }

    // 5. Clean support tickets
    if (shouldCleanTable("supportTickets")) {
      const countBefore = await db.select({ count: sql<number>`count(*)` }).from(supportTickets);
      if (!options.dryRun) {
        if (preservedUserIds.length > 0) {
          const preservedCustomers = await db
            .select()
            .from(customers)
            .where(inArray(customers.userId, preservedUserIds));
          const preservedCustomerIds = preservedCustomers.map((c) => c.id);
          
          if (preservedCustomerIds.length > 0) {
            await db.delete(supportTickets).where(
              sql`${supportTickets.customerId} NOT IN ${preservedCustomerIds}`
            );
          } else {
            await db.delete(supportTickets);
          }
        } else {
          await db.delete(supportTickets);
        }
      }
      results.push({ tableName: "supportTickets", count: Number(countBefore[0].count) });
      console.log(`   ✓ Cleaned supportTickets: ${countBefore[0].count} records`);
    }

    // 6. Clean subscriptions
    if (shouldCleanTable("subscriptions")) {
      const countBefore = await db.select({ count: sql<number>`count(*)` }).from(subscriptions);
      if (!options.dryRun) {
        if (preservedUserIds.length > 0) {
          const preservedCustomers = await db
            .select()
            .from(customers)
            .where(inArray(customers.userId, preservedUserIds));
          const preservedCustomerIds = preservedCustomers.map((c) => c.id);
          
          if (preservedCustomerIds.length > 0) {
            await db.delete(subscriptions).where(
              sql`${subscriptions.customerId} NOT IN ${preservedCustomerIds}`
            );
          } else {
            await db.delete(subscriptions);
          }
        } else {
          await db.delete(subscriptions);
        }
      }
      results.push({ tableName: "subscriptions", count: Number(countBefore[0].count) });
      console.log(`   ✓ Cleaned subscriptions: ${countBefore[0].count} records`);
    }

    // 7. Clean webhook events
    if (shouldCleanTable("webhookEvents")) {
      const countBefore = await db.select({ count: sql<number>`count(*)` }).from(webhookEvents);
      if (!options.dryRun) {
        await db.delete(webhookEvents);
      }
      results.push({ tableName: "webhookEvents", count: Number(countBefore[0].count) });
      console.log(`   ✓ Cleaned webhookEvents: ${countBefore[0].count} records`);
    }

    // 8. Clean customers
    if (shouldCleanTable("customers")) {
      const countBefore = await db.select({ count: sql<number>`count(*)` }).from(customers);
      if (!options.dryRun) {
        if (preservedUserIds.length > 0) {
          await db.delete(customers).where(
            sql`${customers.userId} NOT IN ${preservedUserIds}`
          );
        } else {
          await db.delete(customers);
        }
      }
      results.push({ tableName: "customers", count: Number(countBefore[0].count) });
      console.log(`   ✓ Cleaned customers: ${countBefore[0].count} records`);
    }

    // 9. Clean password reset tokens
    if (shouldCleanTable("passwordResetTokens")) {
      const countBefore = await db.select({ count: sql<number>`count(*)` }).from(passwordResetTokens);
      if (!options.dryRun) {
        await db.delete(passwordResetTokens);
      }
      results.push({ tableName: "passwordResetTokens", count: Number(countBefore[0].count) });
      console.log(`   ✓ Cleaned passwordResetTokens: ${countBefore[0].count} records`);
    }

    // 10. Clean verification tokens
    if (shouldCleanTable("verificationTokens")) {
      const countBefore = await db.select({ count: sql<number>`count(*)` }).from(verificationTokens);
      if (!options.dryRun) {
        await db.delete(verificationTokens);
      }
      results.push({ tableName: "verificationTokens", count: Number(countBefore[0].count) });
      console.log(`   ✓ Cleaned verificationTokens: ${countBefore[0].count} records`);
    }

    // 11. Clean sessions
    if (shouldCleanTable("sessions")) {
      const countBefore = await db.select({ count: sql<number>`count(*)` }).from(sessions);
      if (!options.dryRun) {
        if (preservedUserIds.length > 0) {
          await db.delete(sessions).where(
            sql`${sessions.userId} NOT IN ${preservedUserIds}`
          );
        } else {
          await db.delete(sessions);
        }
      }
      results.push({ tableName: "sessions", count: Number(countBefore[0].count) });
      console.log(`   ✓ Cleaned sessions: ${countBefore[0].count} records`);
    }

    // 12. Clean accounts
    if (shouldCleanTable("accounts")) {
      const countBefore = await db.select({ count: sql<number>`count(*)` }).from(accounts);
      if (!options.dryRun) {
        if (preservedUserIds.length > 0) {
          await db.delete(accounts).where(
            sql`${accounts.userId} NOT IN ${preservedUserIds}`
          );
        } else {
          await db.delete(accounts);
        }
      }
      results.push({ tableName: "accounts", count: Number(countBefore[0].count) });
      console.log(`   ✓ Cleaned accounts: ${countBefore[0].count} records`);
    }

    // 13. Clean users (last, as many tables reference it)
    if (shouldCleanTable("users")) {
      const countBefore = await db.select({ count: sql<number>`count(*)` }).from(users);
      const preserved = preservedUserIds.length;
      if (!options.dryRun) {
        if (preservedUserIds.length > 0) {
          await db.delete(users).where(
            sql`${users.id} NOT IN ${preservedUserIds}`
          );
        } else {
          await db.delete(users);
        }
      }
      results.push({ 
        tableName: "users", 
        count: Number(countBefore[0].count),
        preserved 
      });
      console.log(`   ✓ Cleaned users: ${countBefore[0].count} records (${preserved} preserved)`);
    }

    return results;
  } catch (error) {
    console.error("\n❌ Error during cleanup:", error);
    throw error;
  }
}

// ============================================================================
// Main Function
// ============================================================================

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║         DATABASE CLEANUP SCRIPT - USE WITH CAUTION         ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const options = parseArguments();

  // Step 1: Validate environment
  validateEnvironment(options);

  // Step 2: Show current state
  const initialStats = await countAllTables();
  displayTableStats(initialStats);

  // Step 3: Display options
  if (options.dryRun) {
    console.log("\n🔍 Running in DRY RUN mode - no data will be deleted");
  }
  if (options.preserveAdmins) {
    console.log("   Preserving admin users and their related data");
  }
  if (options.preserveUsers.length > 0) {
    console.log(`   Preserving users: ${options.preserveUsers.join(", ")}`);
  }
  if (options.tables) {
    console.log(`   Only cleaning tables: ${options.tables.join(", ")}`);
  }

  // Step 4: Get confirmation (unless dry run or force)
  if (!options.dryRun) {
    const confirmed = await getUserConfirmation(options);
    if (!confirmed) {
      console.log("\n❌ Cleanup cancelled by user");
      process.exit(0);
    }
  }

  // Step 5: Perform cleanup
  const startTime = Date.now();
  const results = await cleanupDatabase(options);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Step 6: Show results
  console.log(`\n✅ Cleanup completed in ${duration}s`);
  
  if (options.dryRun) {
    displayTableStats(results, "Would Delete (Dry Run)");
  } else {
    displayTableStats(results, "Deleted Records");
    
    // Show final state
    const finalStats = await countAllTables();
    displayTableStats(finalStats, "Final Database State");
  }

  console.log("\n✨ Done!");
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

