import { NextRequest, NextResponse } from "next/server";
import {
  getAllReleases,
  getReleaseByVersion,
  getLatestRelease,
} from "@/lib/releases";

/**
 * GET /api/releases
 *
 * Returns release notes for the desktop app and other clients.
 *
 * Query parameters:
 * - version: Get a specific version's release notes
 * - latest: Get only the latest release (any truthy value)
 *
 * Examples:
 * - GET /api/releases - All releases
 * - GET /api/releases?version=1.39.0 - Specific version
 * - GET /api/releases?latest=true - Latest release only
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const version = searchParams.get("version");
    const latest = searchParams.get("latest");

    // Return specific version
    if (version) {
      const release = await getReleaseByVersion(version);

      if (!release) {
        return NextResponse.json(
          {
            error: "Release not found",
            version: version,
          },
          { status: 404 },
        );
      }

      return NextResponse.json(release, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      });
    }

    // Return latest release only
    if (latest) {
      const release = await getLatestRelease();

      if (!release) {
        return NextResponse.json(
          { error: "No releases found" },
          { status: 404 },
        );
      }

      return NextResponse.json(release, {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      });
    }

    // Return all releases
    const releases = await getAllReleases();

    return NextResponse.json(
      { releases },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    console.error("[API] Error fetching releases:", error);
    return NextResponse.json(
      { error: "Failed to fetch releases" },
      { status: 500 },
    );
  }
}
