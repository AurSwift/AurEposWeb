"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download, Loader2, AlertCircle } from "lucide-react";
import { ReleaseInfo } from "@/lib/github/releases";

/**
 * Detect user's operating system
 */
function detectOS(): string {
  if (typeof window === "undefined") return "Windows";

  const userAgent = window.navigator.userAgent.toLowerCase();
  if (userAgent.includes("mac")) return "macOS";
  if (userAgent.includes("win")) return "Windows";
  if (userAgent.includes("linux")) return "Linux";
  return "Windows"; // Default to Windows
}

export function SuccessDownloadButton() {
  const [open, setOpen] = useState(false);
  const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Fetch release data when dialog opens
  useEffect(() => {
    if (open && !releaseInfo && !isLoading) {
      fetchReleaseData();
    }
  }, [open]);

  // Set default platform when data is available
  useEffect(() => {
    if (releaseInfo && releaseInfo.downloads.length > 0 && !selectedPlatform) {
      const detectedOS = detectOS();
      const matchingDownload = releaseInfo.downloads.find(
        (d) => d.platform === detectedOS
      );
      setSelectedPlatform(
        matchingDownload?.platform || releaseInfo.downloads[0].platform
      );
    }
  }, [releaseInfo, selectedPlatform]);

  const fetchReleaseData = async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const response = await fetch("/api/releases/latest");

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch release data");
      }

      const data: ReleaseInfo = await response.json();
      setReleaseInfo(data);
    } catch (err) {
      console.error("Error fetching release data:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load release information"
      );
    } finally {
      setIsLoading(false);
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
      // Close dialog after initiating download
      setTimeout(() => setOpen(false), 500);
    }
  };

  const handleDirectDownload = () => {
    // If we already have data and a single option, download directly
    if (releaseInfo && releaseInfo.downloads.length === 1) {
      const download = releaseInfo.downloads[0];
      window.open(download.url, "_blank", "noopener,noreferrer");
    } else {
      // Otherwise open the dialog
      setOpen(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex-1">
          <Download className="mr-2 h-4 w-4" />
          Download Software
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download AurSwift EPOS Software</DialogTitle>
          <DialogDescription>
            Choose your platform to download the latest version
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {/* Error State */}
          {error && !releaseInfo && (
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
                onClick={fetchReleaseData}
                disabled={isLoading}
                variant="outline"
                className="w-full"
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Success State with Platform Selection */}
          {releaseInfo && !isLoading && (
            <div className="space-y-4">
              {/* Version Info */}
              <div className="p-3 bg-muted/50 rounded-md">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Latest Version
                    </p>
                    <p className="text-sm font-semibold">
                      Version {releaseInfo.version}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Released</p>
                    <p className="text-sm font-semibold">
                      {releaseInfo.publishedAtFormatted}
                    </p>
                  </div>
                </div>
              </div>

              {releaseInfo.downloads.length > 0 && (
                <>
                  {/* Platform Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Select Platform
                    </label>
                    <Select
                      value={selectedPlatform}
                      onValueChange={setSelectedPlatform}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent>
                        {releaseInfo.downloads.map((download) => (
                          <SelectItem
                            key={download.platform}
                            value={download.platform}
                          >
                            <div className="flex items-center justify-between gap-4 w-full">
                              <span className="font-medium">
                                {download.platform}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {download.sizeFormatted}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Selected file info */}
                  {selectedPlatform && (
                    <div className="text-xs text-center text-muted-foreground p-2 bg-muted/30 rounded">
                      {
                        releaseInfo.downloads.find(
                          (d) => d.platform === selectedPlatform
                        )?.filename
                      }
                    </div>
                  )}

                  {/* Download Button */}
                  <Button
                    onClick={handleDownload}
                    disabled={!selectedPlatform}
                    className="w-full"
                    size="lg"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download for {selectedPlatform || "..."}
                  </Button>
                </>
              )}

              {releaseInfo.downloads.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">
                    No downloads available yet
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

