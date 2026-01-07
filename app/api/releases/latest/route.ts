import { NextResponse } from "next/server";
import { fetchLatestRelease } from "@/lib/github/releases";

// Enable caching for 5 minutes (300 seconds)
export const revalidate = 300;

/**
 * GET /api/releases/latest
 * Fetches the latest release information from GitHub
 */
export async function GET() {
  try {
    const owner = process.env.GITHUB_REPO_OWNER || "AurSwift";
    const repo = process.env.GITHUB_REPO_NAME || "AurSwift";

    const releaseInfo = await fetchLatestRelease(owner, repo);

    // Check if we have any downloads
    if (releaseInfo.downloads.length === 0) {
      return NextResponse.json(
        {
          error: "No downloadable assets found in the latest release",
          releaseUrl: releaseInfo.releaseUrl,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(releaseInfo, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Error fetching latest release:", error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes("rate limit")) {
        return NextResponse.json(
          {
            error: "GitHub API rate limit exceeded",
            message:
              "We're temporarily unable to fetch the latest version. Please try again in a few minutes.",
            retryAfter: 300, // 5 minutes
          },
          { status: 429 }
        );
      }

      if (error.message.includes("No releases found")) {
        return NextResponse.json(
          {
            error: "No releases found",
            message: "No releases are currently available for this software.",
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: "Failed to fetch release information",
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred while fetching release information.",
      },
      { status: 500 }
    );
  }
}

