import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL!);

try {
  console.log('Creating releases tables...');
  
  // Create releases table
  await client`
    CREATE TABLE IF NOT EXISTS "releases" (
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
    )
  `;
  console.log('✓ Created releases table');

  // Create release_images table
  await client`
    CREATE TABLE IF NOT EXISTS "release_images" (
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
    )
  `;
  console.log('✓ Created release_images table');

  // Create indexes
  await client`CREATE INDEX IF NOT EXISTS "releases_version_idx" ON "releases" USING btree ("version")`;
  await client`CREATE INDEX IF NOT EXISTS "releases_release_date_idx" ON "releases" USING btree ("release_date")`;
  await client`CREATE INDEX IF NOT EXISTS "releases_published_idx" ON "releases" USING btree ("published")`;
  await client`CREATE INDEX IF NOT EXISTS "release_images_stored_filename_idx" ON "release_images" USING btree ("stored_filename")`;
  console.log('✓ Created indexes');

  // Add foreign keys
  await client`ALTER TABLE "releases" ADD CONSTRAINT IF NOT EXISTS "releases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action`;
  await client`ALTER TABLE "release_images" ADD CONSTRAINT IF NOT EXISTS "release_images_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action`;
  console.log('✓ Created foreign keys');

  console.log('\n✅ Releases tables created successfully!');
} catch (error) {
  console.error('Error:', error);
} finally {
  await client.end();
}
