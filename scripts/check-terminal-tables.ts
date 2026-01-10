/**
 * Check if terminal_sessions table exists
 */

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function checkTables() {
  try {
    console.log("Checking terminal_sessions table...");
    
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'terminal_sessions'
      );
    `);
    
    console.log("Table exists:", result.rows[0]);
    
    // If table exists, get count
    if (result.rows[0]?.exists) {
      const count = await db.execute(sql`SELECT COUNT(*) FROM terminal_sessions;`);
      console.log("Terminal sessions count:", count.rows[0]);
    }
    
  } catch (error) {
    console.error("Error checking tables:", error);
  }
  
  process.exit(0);
}

checkTables();
