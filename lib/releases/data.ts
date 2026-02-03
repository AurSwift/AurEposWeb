/**
 * Customer-Facing Release Notes Data
 *
 * This file contains human-written, customer-friendly release notes.
 * Unlike the auto-generated CHANGELOG.md, these are written for end users.
 *
 * Guidelines for writing release notes:
 * - Focus on user benefits, not technical implementation
 * - Use plain language, avoid jargon
 * - Lead with the most impactful changes
 * - Only include releases with notable user-facing changes
 */

import type { CustomerReleaseNote } from "./types";

export const releaseNotes: CustomerReleaseNote[] = [
  {
    version: "1.39.0",
    date: "2026-01-25",
    title: "Smarter Updates & Better Stability",
    summary:
      "Updates now install seamlessly in the background, so you're never interrupted mid-work. Plus, we've made significant improvements to system stability.",
    isMajor: false,
    type: "minor",
    features: [
      {
        title: "Silent Background Updates",
        description:
          "Updates download and prepare in the background. When ready, you'll see a gentle notification — install when it suits you, not when we say so.",
        icon: "Download",
      },
      {
        title: "Restart to Update",
        description:
          "No more forced restarts. Updates apply the next time you naturally restart the app, keeping your workflow uninterrupted.",
        icon: "RefreshCw",
      },
    ],
    improvements: [
      {
        description: "Faster startup time when checking for updates on launch",
      },
      {
        description: "Better network error handling during update downloads",
      },
      {
        description: "Reduced memory usage during background update checks",
      },
    ],
    fixes: [
      {
        description:
          "Fixed an issue where update notifications could appear multiple times",
      },
      {
        description:
          "Resolved a rare crash when resuming interrupted downloads",
      },
    ],
  },
  {
    version: "1.38.0",
    date: "2026-01-25",
    title: "Refreshed Look & Feel",
    summary:
      "We've polished the interface throughout the app for a more consistent and pleasant experience.",
    isMajor: false,
    type: "minor",
    features: [
      {
        title: "Enhanced Typography",
        description:
          "Text throughout the app is now easier to read with improved font weights and spacing.",
        icon: "Type",
      },
    ],
    improvements: [
      {
        description: "Consistent button styles across all screens",
      },
      {
        description: "Better contrast for improved accessibility",
      },
      {
        description: "Smoother animations and transitions",
      },
    ],
  },
  {
    version: "1.37.0",
    date: "2026-01-20",
    title: "Receipt Printing Improvements",
    summary:
      "Major improvements to receipt printing reliability and customization options.",
    isMajor: false,
    type: "minor",
    features: [
      {
        title: "Custom Receipt Templates",
        description:
          "Create and save multiple receipt templates for different transaction types.",
        icon: "FileText",
      },
      {
        title: "Print Preview",
        description: "See exactly how your receipt will look before printing.",
        icon: "Eye",
      },
    ],
    improvements: [
      {
        description: "Faster print spooling for high-volume periods",
      },
      {
        description: "Better support for thermal printer paper sizes",
      },
    ],
    fixes: [
      {
        description: "Fixed alignment issues on some receipt printers",
      },
      {
        description: "Resolved currency symbol display on international setups",
      },
    ],
  },
  {
    version: "1.35.0",
    date: "2026-01-10",
    title: "Inventory Management Overhaul",
    summary:
      "A complete refresh of how you manage stock, with bulk editing, smart alerts, and better organization.",
    isMajor: true,
    type: "minor",
    // imageUrl: "/releases/1.35.0-inventory.png",
    features: [
      {
        title: "Bulk Stock Updates",
        description:
          "Update prices, quantities, or categories for hundreds of items at once with our new bulk editor.",
        icon: "Layers",
      },
      {
        title: "Low Stock Alerts",
        description:
          "Get notified when items fall below your custom thresholds. Never run out of your best sellers again.",
        icon: "Bell",
      },
      {
        title: "Stock Categories",
        description:
          "Organize products into nested categories for easier navigation and reporting.",
        icon: "FolderTree",
      },
    ],
    improvements: [
      {
        description: "Search now finds products by SKU, name, or barcode",
      },
      {
        description: "Stock counts update in real-time across all terminals",
      },
    ],
    fixes: [
      {
        description: "Fixed duplicate entries when importing from CSV",
      },
    ],
  },
  {
    version: "1.30.0",
    date: "2025-12-15",
    title: "Multi-Terminal Support",
    summary:
      "Run Aurswift on multiple terminals in your store with real-time sync between them.",
    isMajor: true,
    type: "minor",
    features: [
      {
        title: "Multiple Terminals",
        description:
          "Set up additional point-of-sale stations that stay in sync automatically.",
        icon: "Monitor",
      },
      {
        title: "Shared Cart",
        description:
          "Start a transaction on one terminal and complete it on another.",
        icon: "ShoppingCart",
      },
      {
        title: "Terminal Dashboard",
        description:
          "See which terminals are active and monitor sales across your store.",
        icon: "LayoutDashboard",
      },
    ],
  },
];

/**
 * Get all release notes, optionally filtered
 */
export function getAllReleases(): CustomerReleaseNote[] {
  return releaseNotes;
}

/**
 * Get a specific release by version
 */
export function getReleaseByVersion(
  version: string,
): CustomerReleaseNote | undefined {
  // Strip 'v' prefix if present
  const cleanVersion = version.replace(/^v/, "");
  return releaseNotes.find((r) => r.version === cleanVersion);
}

/**
 * Get the latest release
 */
export function getLatestRelease(): CustomerReleaseNote | undefined {
  return releaseNotes[0];
}

/**
 * Get major releases only
 */
export function getMajorReleases(): CustomerReleaseNote[] {
  return releaseNotes.filter((r) => r.isMajor);
}
