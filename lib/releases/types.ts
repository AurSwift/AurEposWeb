/**
 * Customer-Facing Release Notes Types
 * Separate from developer changelogs - written for end users
 */

export interface ReleaseFeature {
  /** Short title for the feature */
  title: string;
  /** User-friendly description of the benefit */
  description: string;
  /** Optional icon name from lucide-react */
  icon?: string;
}

export interface ReleaseFix {
  /** Short description of what was fixed */
  description: string;
}

export interface ReleaseImprovement {
  /** Short description of the improvement */
  description: string;
}

export interface CustomerReleaseNote {
  /** Version number (e.g., "1.39.0") */
  version: string;
  /** Release date in ISO format */
  date: string;
  /** Human-friendly title for this release */
  title: string;
  /** Brief summary of the release (1-2 sentences) */
  summary: string;
  /** New features in this release */
  features?: ReleaseFeature[];
  /** Bug fixes in this release */
  fixes?: ReleaseFix[];
  /** Improvements/enhancements */
  improvements?: ReleaseImprovement[];
  /** Optional hero image URL for the release */
  imageUrl?: string;
  /** Whether this is a major release (shows prominently) */
  isMajor?: boolean;
  /** Release type badge */
  type?: "major" | "minor" | "patch";
}

/**
 * Determines release type from version string
 */
export function getReleaseType(
  version: string,
  previousVersion?: string,
): "major" | "minor" | "patch" {
  const [major, minor] = version.split(".").map(Number);

  if (!previousVersion) {
    // First release or can't determine
    if (minor === 0) return "major";
    return "minor";
  }

  const [prevMajor, prevMinor] = previousVersion.split(".").map(Number);

  if (major > prevMajor) return "major";
  if (minor > prevMinor) return "minor";
  return "patch";
}

/**
 * Format date for display
 */
export function formatReleaseDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
