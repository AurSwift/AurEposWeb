/**
 * Seed Release Notes to Database
 *
 * This script populates the releases table with seed data.
 * Run with: npx tsx scripts/seed-releases.ts
 *
 * Make sure DATABASE_URL is set in your .env.local file.
 */

import { db, releases } from "@/lib/db";
import { seedReleaseNotes } from "@/lib/releases/seed-data";
import { eq } from "drizzle-orm";

async function seedReleases() {
  console.log("🌱 Seeding release notes...");

  try {
    for (const release of seedReleaseNotes) {
      console.log(`  📦 Processing release v${release.version}...`);

      // Check if release already exists
      const existing = await db
        .select()
        .from(releases)
        .where(eq(releases.version, release.version))
        .limit(1);

      if (existing.length > 0) {
        console.log(
          `  ⏭️  Release v${release.version} already exists, skipping`,
        );
        continue;
      }

      // Insert new release
      await db.insert(releases).values({
        version: release.version,
        releaseDate: new Date(release.date),
        title: release.title,
        summary: release.summary,
        imageUrl: release.imageUrl ?? null,
        isMajor: release.isMajor ?? false,
        type: release.type ?? "minor",
        features: release.features ?? [],
        improvements: release.improvements ?? [],
        fixes: release.fixes ?? [],
        published: true, // Publish all seed releases by default
      });

      console.log(`  ✅ Release v${release.version} seeded successfully`);
    }

    console.log("\n✨ Release notes seeding completed!");
  } catch (error) {
    console.error("❌ Error seeding release notes:", error);
    process.exit(1);
  }
}

// Run the seed script
seedReleases()
  .then(() => {
    console.log("👋 Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  });
