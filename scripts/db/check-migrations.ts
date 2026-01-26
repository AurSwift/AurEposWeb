#!/usr/bin/env tsx
/**
 * Script to check migration status
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as dotenv from "dotenv";
import * as path from "path";
import { sql } from "drizzle-orm";

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), ".env.local");
dotenv.config({ path: envPath });

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is not set");
  process.exit(1);
}

async function checkMigrations() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client);
  
  try {
    // Check what migrations are recorded
    console.log("Checking __drizzle_migrations table...");
    const migrations = await db.execute(sql`
      SELECT * FROM drizzle.__drizzle_migrations 
      ORDER BY created_at
    `);
    
    console.log("\nApplied migrations:");
    console.log(JSON.stringify(migrations, null, 2));
    
    // Check if migration 0002 changes are applied (check column type)
    console.log("\nChecking if migration 0002 is applied (machine_id_hash column type)...");
    const columnInfo = await db.execute(sql`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'terminal_sessions' 
        AND column_name = 'machine_id_hash'
    `);
    console.log("terminal_sessions.machine_id_hash:", JSON.stringify(columnInfo, null, 2));
    
    // Check if migration 0003 is applied (check for unique constraint)
    console.log("\nChecking if migration 0003 is applied (unique constraint)...");
    const constraints = await db.execute(sql`
      SELECT 
        constraint_name, 
        constraint_type
      FROM information_schema.table_constraints 
      WHERE table_name = 'terminal_sessions' 
        AND constraint_name = 'terminal_sessions_machine_license_unique'
    `);
    console.log("Unique constraint:", JSON.stringify(constraints, null, 2));
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.end();
  }
}

checkMigrations();
