"use client";

import * as React from "react";
import Image from "next/image";
import {
  Download,
  RefreshCw,
  Type,
  FileText,
  Eye,
  Layers,
  Bell,
  FolderTree,
  Monitor,
  ShoppingCart,
  LayoutDashboard,
  Sparkles,
  Bug,
  Zap,
  LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CustomerReleaseNote, ReleaseFeature } from "@/lib/releases/types";
import { formatReleaseDate } from "@/lib/releases/types";

// Icon mapping for dynamic icon rendering
const iconMap: Record<string, LucideIcon> = {
  Download,
  RefreshCw,
  Type,
  FileText,
  Eye,
  Layers,
  Bell,
  FolderTree,
  Monitor,
  ShoppingCart,
  LayoutDashboard,
  Sparkles,
  Bug,
  Zap,
};

interface ReleaseCardProps {
  release: CustomerReleaseNote;
  isHighlighted?: boolean;
}

export function ReleaseCard({ release, isHighlighted }: ReleaseCardProps) {
  const hasFeatures = release.features && release.features.length > 0;
  const hasImprovements =
    release.improvements && release.improvements.length > 0;
  const hasFixes = release.fixes && release.fixes.length > 0;

  return (
    <Card
      id={`v${release.version}`}
      className={cn(
        "scroll-mt-24 transition-all duration-300",
        isHighlighted && "ring-2 ring-primary ring-offset-2",
        release.isMajor && "border-primary/50",
      )}
    >
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-xl md:text-2xl">{release.title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant={release.isMajor ? "default" : "secondary"}
              className="font-mono"
            >
              v{release.version}
            </Badge>
            {release.type && (
              <Badge variant="outline" className="capitalize">
                {release.type}
              </Badge>
            )}
          </div>
        </div>
        <CardDescription className="text-base mt-2">
          {formatReleaseDate(release.date)}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary */}
        <p className="text-muted-foreground leading-relaxed">
          {release.summary}
        </p>

        {/* Hero Image */}
        {release.imageUrl && (
          <div className="rounded-lg overflow-hidden border bg-muted relative aspect-video">
            <Image
              src={release.imageUrl}
              alt={`${release.title} preview`}
              fill
              className="object-cover"
            />
          </div>
        )}

        {/* Features */}
        {hasFeatures && (
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              What&apos;s New
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              {release.features!.map((feature, index) => (
                <FeatureItem key={index} feature={feature} />
              ))}
            </div>
          </div>
        )}

        {/* Improvements */}
        {hasImprovements && (
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Zap className="h-4 w-4" />
              Improvements
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {release.improvements!.map((improvement, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1.5">•</span>
                  {improvement.description}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Bug Fixes */}
        {hasFixes && (
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2 text-green-600 dark:text-green-400">
              <Bug className="h-4 w-4" />
              Bug Fixes
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {release.fixes!.map((fix, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-green-500 mt-1.5">•</span>
                  {fix.description}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Pre-render icon component to avoid creation during render
function FeatureIcon({ iconName }: { iconName?: string }) {
  const Icon = iconName && iconMap[iconName] ? iconMap[iconName] : Sparkles;
  return <Icon className="h-5 w-5 text-primary" />;
}

function FeatureItem({ feature }: { feature: ReleaseFeature }) {
  return (
    <div className="flex gap-3 p-4 rounded-lg bg-muted/50 border">
      <div className="shrink-0">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <FeatureIcon iconName={feature.icon} />
        </div>
      </div>
      <div className="space-y-1">
        <h5 className="font-medium text-sm">{feature.title}</h5>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {feature.description}
        </p>
      </div>
    </div>
  );
}
