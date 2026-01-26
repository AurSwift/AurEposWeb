#!/usr/bin/env tsx
/**
 * Script to run drizzle migrations
 * This ensures environment variables are properly loaded
 */

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), ".env.local");
dotenv.config({ path: envPath });

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is not set");
  console.error(`Please ensure .env.local exists and contains DATABASE_URL`);
  process.exit(1);
}

async function runMigrations() {
  console.log("Connecting to database...");
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client);
  
  console.log("Running drizzle migrations...");
  try {
    await migrate(db, {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
    console.log("✓ Migrations completed successfully");
  } catch (error) {
    console.error("✗ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
