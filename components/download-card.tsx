import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Monitor, Lock } from "lucide-react";
import { DownloadCardClient } from "@/components/download-card-client";
import {
  checkDownloadAccess,
  getDownloadAccessMessage,
} from "@/lib/subscription/download-access";
import { fetchLatestRelease } from "@/lib/github/releases";
import Link from "next/link";

interface DownloadCardProps {
  subscriptionStatus?: string | null;
}

export async function DownloadCard({
  subscriptionStatus,
}: DownloadCardProps) {
  // Check if user has access to download
  const accessResult = checkDownloadAccess(subscriptionStatus);

  // Fetch release data only if user has access
  let releaseInfo = null;
  let fetchError: string | undefined;

  if (accessResult.canDownload) {
    try {
      releaseInfo = await fetchLatestRelease();
    } catch (error) {
      console.error("Error fetching release data:", error);
      fetchError =
        error instanceof Error
          ? error.message
          : "Unable to load release information";
    }
  }

  return (
    <Card className="border-2 border-accent/30 bg-accent/5">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Monitor className="w-5 h-5 text-accent" />
          Software Download
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {getDownloadAccessMessage(accessResult)}
        </p>

        {accessResult.canDownload ? (
          <DownloadCardClient
            initialData={releaseInfo}
            initialError={fetchError}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 p-4 bg-muted/50 rounded-md border border-muted">
              <Lock className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Active subscription required
              </span>
            </div>
            <Link href="/pricing" className="block">
              <Button className="w-full" size="lg">
                View Subscription Plans
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
