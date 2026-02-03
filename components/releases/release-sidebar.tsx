"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { CustomerReleaseNote } from "@/lib/releases/types";

interface ReleaseSidebarProps {
  releases: CustomerReleaseNote[];
  activeVersion?: string;
}

export function ReleaseSidebar({
  releases,
  activeVersion,
}: ReleaseSidebarProps) {
  return (
    <aside className="hidden lg:block w-64 shrink-0">
      <div className="sticky top-24">
        <h3 className="font-semibold mb-4 text-sm text-muted-foreground uppercase tracking-wider">
          Versions
        </h3>
        <ScrollArea className="h-[calc(100vh-200px)]">
          <nav className="space-y-1">
            {releases.map((release) => (
              <Link
                key={release.version}
                href={`#v${release.version}`}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                  "hover:bg-muted",
                  activeVersion === release.version
                    ? "bg-muted font-medium"
                    : "text-muted-foreground",
                )}
              >
                <span className="font-mono">v{release.version}</span>
                {release.isMajor && (
                  <Badge variant="secondary" className="text-[10px] px-1.5">
                    Major
                  </Badge>
                )}
              </Link>
            ))}
          </nav>
        </ScrollArea>
      </div>
    </aside>
  );
}
