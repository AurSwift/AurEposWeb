"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, RefreshCw, AlertCircle } from "lucide-react";
import { ReleaseInfo } from "@/lib/github/releases";

interface DownloadCardClientProps {
  initialData: ReleaseInfo | null;
  initialError?: string;
}

export function DownloadCardClient({
  initialData,
  initialError,
}: DownloadCardClientProps) {
  const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(
    initialData
  );
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | undefined>(initialError);

  // Set default platform when data is available
  useState(() => {
    if (releaseInfo && releaseInfo.downloads.length > 0 && !selectedPlatform) {
      // Default to Windows if available, otherwise first option
      const windowsDownload = releaseInfo.downloads.find(
        (d) => d.platform === "Windows"
      );
      setSelectedPlatform(
        windowsDownload?.platform || releaseInfo.downloads[0].platform
      );
    }
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(undefined);

    try {
      const response = await fetch("/api/releases/latest", {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch release data");
      }

      const data: ReleaseInfo = await response.json();
      setReleaseInfo(data);

      // Update selected platform if current selection is not available
      if (
        !data.downloads.find((d) => d.platform === selectedPlatform) &&
        data.downloads.length > 0
      ) {
        const windowsDownload = data.downloads.find(
          (d) => d.platform === "Windows"
        );
        setSelectedPlatform(
          windowsDownload?.platform || data.downloads[0].platform
        );
      }
    } catch (err) {
      console.error("Error refreshing release data:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to refresh release information"
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDownload = () => {
    if (!releaseInfo || !selectedPlatform) return;

    const download = releaseInfo.downloads.find(
      (d) => d.platform === selectedPlatform
    );
    if (download) {
      // Open download URL in new tab
      window.open(download.url, "_blank", "noopener,noreferrer");
    }
  };

  // Error state
  if (error && !releaseInfo) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-destructive font-medium">
              Unable to load release information
            </p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          variant="outline"
          className="w-full"
        >
          <RefreshCw
            className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Try Again
        </Button>
      </div>
    );
  }

  // Loading state (no data and no error)
  if (!releaseInfo) {
    return (
      <div className="space-y-4">
        <div className="h-20 bg-muted/50 rounded-md animate-pulse" />
        <div className="h-10 bg-muted/50 rounded-md animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Version Info */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Latest Version</p>
          <p className="text-sm font-semibold">
            Version {releaseInfo.version}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Refresh release information"
        >
          <RefreshCw
            className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Released {releaseInfo.publishedAtFormatted}
      </p>

      {/* Error message during refresh */}
      {error && (
        <div className="flex items-start gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Platform Selection */}
      {releaseInfo.downloads.length > 0 && (
        <>
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select platform" />
            </SelectTrigger>
            <SelectContent>
              {releaseInfo.downloads.map((download) => (
                <SelectItem key={download.platform} value={download.platform}>
                  <div className="flex items-center justify-between gap-4">
                    <span>{download.platform}</span>
                    <span className="text-xs text-muted-foreground">
                      {download.sizeFormatted}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Download Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleDownload}
            disabled={!selectedPlatform}
          >
            <Download className="w-5 h-5 mr-2" />
            Download for {selectedPlatform || "..."}
          </Button>

          {/* Selected file info */}
          {selectedPlatform && (
            <p className="text-xs text-center text-muted-foreground">
              {
                releaseInfo.downloads.find(
                  (d) => d.platform === selectedPlatform
                )?.filename
              }
            </p>
          )}
        </>
      )}

      {/* No downloads available */}
      {releaseInfo.downloads.length === 0 && (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            No downloads available yet
          </p>
          <Button
            variant="link"
            size="sm"
            onClick={() => window.open(releaseInfo.releaseUrl, "_blank")}
            className="mt-2"
          >
            View on GitHub
          </Button>
        </div>
      )}
    </div>
  );
}

