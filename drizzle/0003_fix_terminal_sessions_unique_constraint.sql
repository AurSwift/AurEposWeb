-- Fix terminal_sessions to prevent duplicate sessions for the same machine+license
-- Add unique constraint and clean up existing duplicates

-- Step 1: Clean up existing duplicates
-- Keep only the most recent session for each machine+license combination
DELETE FROM terminal_sessions
WHERE id NOT IN (
    SELECT DISTINCT ON (machine_id_hash, license_key) id
    FROM terminal_sessions
    ORDER BY machine_id_hash, license_key, last_connected_at DESC
);

-- Step 2: Add unique constraint to prevent future duplicates
ALTER TABLE terminal_sessions
ADD CONSTRAINT terminal_sessions_machine_license_unique UNIQUE (machine_id_hash, license_key);

-- Step 3: Create index to improve performance on upsert operations
-- (The unique constraint automatically creates an index, but we want to ensure optimal ordering)
CREATE INDEX IF NOT EXISTS terminal_sessions_upsert_lookup_idx 
ON terminal_sessions (license_key, machine_id_hash, last_connected_at DESC);
