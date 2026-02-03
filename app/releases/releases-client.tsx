"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { ReleaseCard, ReleaseSidebar } from "@/components/releases";
import type { CustomerReleaseNote } from "@/lib/releases/types";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface ReleasesPageClientProps {
  releases: CustomerReleaseNote[];
  highlightedVersion?: string;
}

export function ReleasesPageClient({
  releases,
  highlightedVersion,
}: ReleasesPageClientProps) {
  const [activeVersion, setActiveVersion] = useState<string | undefined>(
    highlightedVersion,
  );

  // Scroll to highlighted version on mount
  useEffect(() => {
    if (highlightedVersion) {
      const element = document.getElementById(`v${highlightedVersion}`);
      if (element) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    }
  }, [highlightedVersion]);

  // Track active version based on scroll position
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const version = entry.target.id.replace("v", "");
            setActiveVersion(version);
          }
        });
      },
      {
        rootMargin: "-100px 0px -70% 0px",
        threshold: 0,
      },
    );

    releases.forEach((release) => {
      const element = document.getElementById(`v${release.version}`);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [releases]);

  const latestRelease = releases[0];

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <div className="max-w-3xl mb-12">
        <div className="flex items-center gap-3 mb-4">
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" />
            Latest Release
          </Badge>
          <Badge variant="outline" className="font-mono">
            v{latestRelease?.version}
          </Badge>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          Release Notes
        </h1>
        <p className="text-xl text-muted-foreground">
          Stay up to date with the latest features, improvements, and fixes in
          Aurswift EPOS.
        </p>
      </div>

      {/* Content with Sidebar */}
      <div className="flex gap-12">
        {/* Sidebar Navigation */}
        <ReleaseSidebar releases={releases} activeVersion={activeVersion} />

        {/* Release Cards */}
        <div className="flex-1 space-y-8 max-w-3xl">
          {releases.map((release) => (
            <ReleaseCard
              key={release.version}
              release={release}
              isHighlighted={highlightedVersion === release.version}
            />
          ))}

          {/* End of releases */}
          <div className="text-center py-12 text-muted-foreground">
            <p>You&apos;ve reached the beginning of our release history.</p>
            <p className="text-sm mt-1">
              Thank you for being part of the Aurswift journey!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
