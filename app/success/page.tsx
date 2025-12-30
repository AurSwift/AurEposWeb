"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, Download, ArrowRight, Loader2 } from "lucide-react";
import { LicenseKeyCard } from "@/components/license-key-card";
import { Label } from "@/components/ui/label";

interface Subscription {
  planId: string;
  billingCycle: string;
  trialEnd?: Date;
}

export default function SuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get("session_id");

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [licenseKey, setLicenseKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function syncSubscription() {
      if (!sessionId) {
        setError("No session ID found");
        setLoading(false);
        return;
      }

      try {
        // Call sync endpoint
        const response = await fetch("/api/stripe/sync-subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to sync subscription");
        }

        setSubscription(data.subscription);
        setLicenseKey(data.licenseKey);
      } catch (err) {
        console.error("Sync error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load subscription"
        );
      } finally {
        setLoading(false);
      }
    }

    syncSubscription();
  }, [sessionId]);

  useEffect(() => {
    async function syncSubscription() {
      if (!sessionId) {
        setError("No session ID found");
        setLoading(false);
        return;
      }

      try {
        // Call sync endpoint
        const response = await fetch("/api/stripe/sync-subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to sync subscription");
        }

        setSubscription(data.subscription);
        setLicenseKey(data.licenseKey);
      } catch (err) {
        console.error("Sync error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load subscription"
        );
      } finally {
        setLoading(false);
      }
    }

    syncSubscription();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-light">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">
            Setting up your subscription...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-light p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => router.push("/dashboard")}
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-light p-4">
      <div className="w-full max-w-2xl space-y-6">
        <Card>
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold">
              Welcome to Auraswif!
            </CardTitle>
            <CardDescription className="text-lg">
              Your subscription is active and your license key is ready
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {licenseKey && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Your License Key</Label>
                <LicenseKeyCard licenseKey={licenseKey} />
              </div>
            )}

            {subscription && (
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Plan:</span>
                  <span className="font-semibold capitalize">
                    {subscription.planId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Billing Cycle:
                  </span>
                  <span className="font-semibold capitalize">
                    {subscription.billingCycle}
                  </span>
                </div>
                {subscription.trialEnd && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Trial Ends:
                    </span>
                    <span className="font-semibold">
                      {new Date(subscription.trialEnd).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <h3 className="font-semibold">Next Steps:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Download and install the EPOS software</li>
                <li>Enter your license key when prompted</li>
                <li>Start using Auraswif EPOS!</li>
              </ol>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" className="flex-1" asChild>
                <Link href="/dashboard">
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Go to Dashboard
                </Link>
              </Button>
              <Button className="flex-1" asChild>
                <a href="#" download>
                  <Download className="mr-2 h-4 w-4" />
                  Download Software
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
