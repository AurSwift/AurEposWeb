-- Fix machine_id_hash column length in terminal_sessions and terminal_coordination_events
-- The machine fingerprint format is MF2-{64 char SHA256} = 68 chars minimum
-- Some values can be longer, so increase from varchar(64) to varchar(128) for safety

ALTER TABLE "terminal_sessions" ALTER COLUMN "machine_id_hash" TYPE varchar(128);
--> statement-breakpoint
ALTER TABLE "terminal_coordination_events" ALTER COLUMN "machine_id_hash" TYPE varchar(128);
