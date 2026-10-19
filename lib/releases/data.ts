/**
 * Customer-Facing Release Notes Data
 *
 * This module queries release notes from the database.
 * Releases are managed through the admin panel and stored in the database.
 */

import { db, releases } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import type {
  CustomerReleaseNote,
  ReleaseFeature,
  ReleaseFix,
  ReleaseImprovement,
} from "./types";

/**
 * Map database release to CustomerReleaseNote format
 */
function mapDbReleaseToCustomerNote(dbRelease: any): CustomerReleaseNote {
  return {
    version: dbRelease.version,
    date: dbRelease.releaseDate.toISOString().split("T")[0], // Format as YYYY-MM-DD
    title: dbRelease.title,
    summary: dbRelease.summary,
    imageUrl: dbRelease.imageUrl ?? undefined,
    isMajor: dbRelease.isMajor,
    type: dbRelease.type as "major" | "minor" | "patch",
    features: (dbRelease.features as ReleaseFeature[]) ?? undefined,
    improvements: (dbRelease.improvements as ReleaseImprovement[]) ?? undefined,
    fixes: (dbRelease.fixes as ReleaseFix[]) ?? undefined,
  };
}

/**
 * Get all published release notes, ordered by release date (newest first)
 */
export async function getAllReleases(): Promise<CustomerReleaseNote[]> {
  try {
    const dbReleases = await db
      .select()
      .from(releases)
      .where(eq(releases.published, true))
      .orderBy(desc(releases.releaseDate));

    return dbReleases.map(mapDbReleaseToCustomerNote);
  } catch (error) {
    console.error("Error fetching releases from database:", error);
    // Return empty array on error to prevent page crash
    return [];
  }
}

/**
 * Get a specific release by version
 */
export async function getReleaseByVersion(
  version: string,
): Promise<CustomerReleaseNote | undefined> {
  try {
    // Strip 'v' prefix if present
    const cleanVersion = version.replace(/^v/, "");

    const dbRelease = await db
      .select()
      .from(releases)
      .where(eq(releases.version, cleanVersion))
      .limit(1);

    if (dbRelease.length === 0) {
      return undefined;
    }

    return mapDbReleaseToCustomerNote(dbRelease[0]);
  } catch (error) {
    console.error(`Error fetching release version ${version}:`, error);
    return undefined;
  }
}

/**
 * Get the latest published release
 */
export async function getLatestRelease(): Promise<
  CustomerReleaseNote | undefined
> {
  try {
    const dbRelease = await db
      .select()
      .from(releases)
      .where(eq(releases.published, true))
      .orderBy(desc(releases.releaseDate))
      .limit(1);

    if (dbRelease.length === 0) {
      return undefined;
    }

    return mapDbReleaseToCustomerNote(dbRelease[0]);
  } catch (error) {
    console.error("Error fetching latest release:", error);
    return undefined;
  }
}

/**
 * Get major releases only
 */
export async function getMajorReleases(): Promise<CustomerReleaseNote[]> {
  try {
    const dbReleases = await db
      .select()
      .from(releases)
      .where(eq(releases.isMajor, true))
      .orderBy(desc(releases.releaseDate));

    return dbReleases.map(mapDbReleaseToCustomerNote);
  } catch (error) {
    console.error("Error fetching major releases:", error);
    return [];
  }
}
