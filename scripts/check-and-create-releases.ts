import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL!);

(async () => {
  try {
    const tables = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('releases', 'release_images')
      ORDER BY table_name
    `;
    
    console.log('Release tables in database:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));
    
    if (tables.length === 0) {
      console.log('\n❌ No release tables found. Creating them now...\n');
      
      // Create releases table
      await client`
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
        )
      `;
      console.log('✓ Created releases table');

      // Create release_images table
      await client`
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
        )
      `;
      console.log('✓ Created release_images table');

      // Create indexes
      await client`CREATE INDEX "releases_version_idx" ON "releases" USING btree ("version")`;
      await client`CREATE INDEX "releases_release_date_idx" ON "releases" USING btree ("release_date")`;
      await client`CREATE INDEX "releases_published_idx" ON "releases" USING btree ("published")`;
      await client`CREATE INDEX "release_images_stored_filename_idx" ON "release_images" USING btree ("stored_filename")`;
      console.log('✓ Created indexes');

      // Add foreign keys  
      await client`ALTER TABLE "releases" ADD CONSTRAINT "releases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action`;
      await client`ALTER TABLE "release_images" ADD CONSTRAINT "release_images_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action`;
      console.log('✓ Created foreign keys');

      console.log('\n✅ Releases tables created successfully!');
    } else {
      console.log('\n✅ Release tables already exist!');
    }
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await client.end();
  }
})();
