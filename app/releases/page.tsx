import { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ReleasesPageClient } from "./releases-client";
import { getAllReleases, getReleaseByVersion } from "@/lib/releases";

export const metadata: Metadata = {
  title: "Release Notes | Aurswift",
  description:
    "See what's new in Aurswift EPOS. Latest features, improvements, and bug fixes.",
  openGraph: {
    title: "Release Notes | Aurswift",
    description:
      "See what's new in Aurswift EPOS. Latest features, improvements, and bug fixes.",
  },
};

interface ReleasesPageProps {
  searchParams: Promise<{ version?: string }>;
}

export default async function ReleasesPage({
  searchParams,
}: ReleasesPageProps) {
  const params = await searchParams;
  const releases = getAllReleases();
  const highlightedVersion = params.version?.replace(/^v/, "");

  // If a specific version is requested, verify it exists
  const targetRelease = highlightedVersion
    ? getReleaseByVersion(highlightedVersion)
    : undefined;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <ReleasesPageClient
          releases={releases}
          highlightedVersion={targetRelease?.version}
        />
      </main>
      <Footer />
    </div>
  );
}
