#!/usr/bin/env tsx
/**
 * Script to apply pending migrations 0002 and 0003
 * This script manually applies these migrations since the migrations table is empty
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as dotenv from "dotenv";
import * as path from "path";
import { sql } from "drizzle-orm";
import * as fs from "fs";

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), ".env.local");
dotenv.config({ path: envPath });

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is not set");
  process.exit(1);
}

async function applyPendingMigrations() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client);
  
  try {
    // First, mark migrations 0000 and 0001 as applied (they already exist in DB)
    console.log("Marking migrations 0000 and 0001 as applied...");
    
    // Get the migration hashes from the journal
    const journalPath = path.join(process.cwd(), "drizzle", "meta", "_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
    
    const migration0000 = journal.entries.find((e: any) => e.idx === 0);
    const migration0001 = journal.entries.find((e: any) => e.idx === 1);
    
    if (migration0000 && migration0001) {
      // Check if already exists
      const existing = await db.execute(sql`
        SELECT hash FROM drizzle.__drizzle_migrations 
        WHERE hash IN (${migration0000.tag}, ${migration0001.tag})
      `);
      
      if (existing.length === 0) {
        // Insert migration records (created_at is bigint timestamp)
        const now = Date.now();
        await db.execute(sql`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          VALUES 
            (${migration0000.tag}, ${now}),
            (${migration0001.tag}, ${now + 1})
        `);
        console.log("✓ Marked migrations 0000 and 0001 as applied");
      } else {
        console.log("✓ Migrations 0000 and 0001 already marked as applied");
      }
    }
    
    // Now apply migration 0002
    console.log("\nApplying migration 0002 (fix machine_id_hash length)...");
    const migration0002Path = path.join(process.cwd(), "drizzle", "0002_fix_machine_id_hash_length.sql");
    const migration0002SQL = fs.readFileSync(migration0002Path, "utf-8");
    
    // Execute the migration SQL
    await db.execute(sql.raw(migration0002SQL));
    
    // Record it in migrations table
    const migration0002 = journal.entries.find((e: any) => e.idx === 2);
    if (migration0002) {
      const existing = await db.execute(sql`
        SELECT hash FROM drizzle.__drizzle_migrations WHERE hash = ${migration0002.tag}
      `);
      if (existing.length === 0) {
        await db.execute(sql`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          VALUES (${migration0002.tag}, ${Date.now()})
        `);
      }
    }
    console.log("✓ Migration 0002 applied");
    
    // Now apply migration 0003
    console.log("\nApplying migration 0003 (fix terminal_sessions unique constraint)...");
    const migration0003Path = path.join(process.cwd(), "drizzle", "0003_fix_terminal_sessions_unique_constraint.sql");
    const migration0003SQL = fs.readFileSync(migration0003Path, "utf-8");
    
    // Execute the migration SQL
    await db.execute(sql.raw(migration0003SQL));
    
    // Record it in migrations table
    const migration0003 = journal.entries.find((e: any) => e.idx === 3);
    if (migration0003) {
      const existing = await db.execute(sql`
        SELECT hash FROM drizzle.__drizzle_migrations WHERE hash = ${migration0003.tag}
      `);
      if (existing.length === 0) {
        await db.execute(sql`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          VALUES (${migration0003.tag}, ${Date.now()})
        `);
      }
    }
    console.log("✓ Migration 0003 applied");
    
    console.log("\n✓ All pending migrations applied successfully!");
    
  } catch (error: any) {
    console.error("✗ Migration failed:", error.message);
    if (error.cause) {
      console.error("Cause:", error.cause.message);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyPendingMigrations();
