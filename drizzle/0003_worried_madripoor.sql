CREATE TABLE "release_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" varchar(255) NOT NULL,
	"stored_filename" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"public_url" varchar(500) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "release_images_stored_filename_unique" UNIQUE("stored_filename")
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" varchar(50) NOT NULL,
	"release_date" timestamp with time zone NOT NULL,
	"title" varchar(255) NOT NULL,
	"summary" text NOT NULL,
	"image_url" varchar(500),
	"is_major" boolean DEFAULT false NOT NULL,
	"type" varchar(20) DEFAULT 'minor' NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb,
	"improvements" jsonb DEFAULT '[]'::jsonb,
	"fixes" jsonb DEFAULT '[]'::jsonb,
	"published" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "releases_version_unique" UNIQUE("version")
);
--> statement-breakpoint
DROP INDEX IF EXISTS "terminal_sessions_machine_license_idx";--> statement-breakpoint
ALTER TABLE "terminal_coordination_events" ALTER COLUMN "machine_id_hash" SET DATA TYPE varchar(128);--> statement-breakpoint
ALTER TABLE "terminal_sessions" ALTER COLUMN "machine_id_hash" SET DATA TYPE varchar(128);--> statement-breakpoint
ALTER TABLE "release_images" ADD CONSTRAINT "release_images_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "release_images_stored_filename_idx" ON "release_images" USING btree ("stored_filename");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "releases_version_idx" ON "releases" USING btree ("version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "releases_release_date_idx" ON "releases" USING btree ("release_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "releases_published_idx" ON "releases" USING btree ("published");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "terminal_sessions_upsert_lookup_idx" ON "terminal_sessions" USING btree ("license_key","machine_id_hash","last_connected_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "terminal_sessions" ADD CONSTRAINT "terminal_sessions_machine_license_unique" UNIQUE("machine_id_hash","license_key");
EXCEPTION
 WHEN duplicate_table THEN null;
END $$;