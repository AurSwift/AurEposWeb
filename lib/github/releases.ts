/**
 * GitHub Releases API Integration
 * Fetches latest release information from GitHub repository
 */

// GitHub API Response Types
interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
  created_at: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  assets: GitHubAsset[];
  body: string;
  html_url: string;
}

// Our API Types
export interface ReleaseDownload {
  platform: string;
  url: string;
  filename: string;
  size: number;
  sizeFormatted: string;
}

export interface ReleaseInfo {
  version: string;
  publishedAt: string;
  publishedAtFormatted: string;
  downloads: ReleaseDownload[];
  releaseUrl: string;
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Format date to readable string
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Detect platform from asset filename
 */
function detectPlatform(filename: string): string | null {
  const lowerName = filename.toLowerCase();

  // Windows detection
  if (lowerName.endsWith(".exe") || lowerName.endsWith(".msi")) {
    return "Windows";
  }

  // macOS detection
  if (
    lowerName.endsWith(".dmg") ||
    lowerName.endsWith(".pkg") ||
    (lowerName.endsWith(".zip") &&
      (lowerName.includes("mac") || lowerName.includes("darwin")))
  ) {
    return "macOS";
  }

  // Linux detection
  if (
    lowerName.endsWith(".appimage") ||
    lowerName.endsWith(".deb") ||
    lowerName.endsWith(".rpm") ||
    lowerName.endsWith(".tar.gz")
  ) {
    return "Linux";
  }

  return null;
}

/**
 * Parse GitHub release into our format
 */
function parseRelease(release: GitHubRelease): ReleaseInfo {
  const downloads: ReleaseDownload[] = [];

  // Process each asset
  for (const asset of release.assets) {
    const platform = detectPlatform(asset.name);
    if (platform) {
      downloads.push({
        platform,
        url: asset.browser_download_url,
        filename: asset.name,
        size: asset.size,
        sizeFormatted: formatBytes(asset.size),
      });
    }
  }

  return {
    version: release.tag_name.replace(/^v/, ""), // Remove 'v' prefix if present
    publishedAt: release.published_at,
    publishedAtFormatted: formatDate(release.published_at),
    downloads,
    releaseUrl: release.html_url,
  };
}

/**
 * Fetch latest release from GitHub
 */
export async function fetchLatestRelease(
  owner: string = "AurSwift",
  repo: string = "AurSwift"
): Promise<ReleaseInfo> {
  const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

  try {
    const headers: HeadersInit = {
      Accept: "application/vnd.github.v3+json",
    };

    // Add GitHub token if available for higher rate limits
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(url, {
      headers,
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("No releases found for this repository");
      }
      if (response.status === 403) {
        throw new Error("GitHub API rate limit exceeded. Please try again later.");
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const release: GitHubRelease = await response.json();
    return parseRelease(release);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to fetch release information from GitHub");
  }
}

