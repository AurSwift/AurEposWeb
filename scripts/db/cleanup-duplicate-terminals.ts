/**
 * Clean Up Duplicate Terminal Sessions
 *
 * Run this to manually clean up any remaining duplicate terminal sessions
 * Run with: tsx -r dotenv/config scripts/db/cleanup-duplicate-terminals.ts dotenv_config_path=.env.local
 */

import postgres from "postgres";

async function cleanupDuplicates() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  console.log("🔄 Connecting to database...");
  const client = postgres(databaseUrl, { max: 1 });

  try {
    console.log("🔍 Finding duplicate terminal sessions...");

    const duplicates = await client`
      SELECT 
        machine_id_hash,
        license_key,
        COUNT(*) as count,
        ARRAY_AGG(id ORDER BY last_connected_at DESC) as session_ids,
        ARRAY_AGG(connection_status ORDER BY last_connected_at DESC) as statuses,
        ARRAY_AGG(last_connected_at ORDER BY last_connected_at DESC) as timestamps
      FROM terminal_sessions
      GROUP BY machine_id_hash, license_key
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length === 0) {
      console.log("✅ No duplicate sessions found!");
      return;
    }

    console.log(
      `\n⚠️  Found ${duplicates.length} duplicate machine+license combination(s):\n`
    );

    for (const dup of duplicates) {
      console.log(`📍 Machine: ${dup.machine_id_hash.substring(0, 30)}...`);
      console.log(`   License: ${dup.license_key}`);
      console.log(`   Total Sessions: ${dup.count}`);
      console.log(`   Sessions to delete: ${dup.count - 1}\n`);

      // Show each session
      for (let i = 0; i < dup.session_ids.length; i++) {
        const keep = i === 0 ? "✓ KEEP" : "✗ DELETE";
        console.log(`   ${keep} - ID: ${dup.session_ids[i]}`);
        console.log(`           Status: ${dup.statuses[i]}`);
        console.log(`           Last Connected: ${dup.timestamps[i]}`);
      }
      console.log("");
    }

    console.log("🗑️  Deleting duplicate sessions (keeping most recent)...\n");

    const deleteResult = await client`
      DELETE FROM terminal_sessions
      WHERE id NOT IN (
        SELECT DISTINCT ON (machine_id_hash, license_key) id
        FROM terminal_sessions
        ORDER BY machine_id_hash, license_key, last_connected_at DESC
      )
      RETURNING id, machine_id_hash, connection_status
    `;

    console.log(`✅ Deleted ${deleteResult.length} duplicate session(s)`);

    for (const deleted of deleteResult) {
      console.log(`   - Removed: ${deleted.id} (${deleted.connection_status})`);
    }

    console.log("\n🎯 Cleanup complete!");
    console.log("   Each machine now has exactly ONE session per license.");
  } catch (error) {
    console.error("\n❌ Cleanup failed:");
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

cleanupDuplicates();
