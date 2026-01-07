"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Copy, ExternalLink, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LicenseKey {
  id: string;
  licenseKey: string;
  maxTerminals: number;
  activationCount: number;
  isActive: boolean;
}

interface Subscription {
  id: string;
  planId: string;
  billingCycle: string;
  price: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  nextBillingDate: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd: Date | null;
  licenseKeys: LicenseKey[];
}

export function SubscriptionDetails({
  refreshTrigger,
}: {
  refreshTrigger?: number;
}) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSubscription = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/subscriptions/current", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch subscription");
      }

      setSubscription(data.subscription);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch subscription"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription, refreshTrigger]);

  const handleManageBilling = async () => {
    try {
      const response = await fetch("/api/stripe/billing/portal", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create portal session");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to open billing portal",
        variant: "destructive",
      });
    }
  };

  const copyLicenseKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({
      title: "Copied!",
      description: "License key copied to clipboard",
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      active: { variant: "default", label: "Active" },
      trialing: { variant: "secondary", label: "Trial" },
      past_due: { variant: "destructive", label: "Past Due" },
      cancelled: { variant: "outline", label: "Cancelled" },
      paused: { variant: "secondary", label: "Paused" },
    };

    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPlanName = (planId: string) => {
    const names: Record<string, string> = {
      basic: "Basic",
      professional: "Professional",
      enterprise: "Enterprise",
    };
    return names[planId] || planId;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading subscription...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-destructive">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Active Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            You don't have an active subscription yet.
          </p>
          <Button asChild>
            <a href="/pricing">View Plans</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Plan Info */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">
              {getPlanName(subscription.planId)} Plan
            </h3>
            {getStatusBadge(subscription.status)}
          </div>
          <p className="text-sm text-muted-foreground">
            ${parseFloat(subscription.price).toFixed(2)} /{" "}
            {subscription.billingCycle}
          </p>
        </div>

        {/* Trial Period Warning */}
        {subscription.trialEnd &&
          new Date(subscription.trialEnd) > new Date() && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Trial Period Active
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Your trial ends on{" "}
                  {format(new Date(subscription.trialEnd), "MMM dd, yyyy")}
                </p>
              </div>
            </div>
          )}

        {/* Cancellation Warning */}
        {subscription.cancelAtPeriodEnd && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                Subscription Cancels Soon
              </p>
              <p className="text-xs text-destructive/80">
                Your subscription will end on{" "}
                {format(
                  new Date(subscription.currentPeriodEnd),
                  "MMM dd, yyyy"
                )}
              </p>
            </div>
          </div>
        )}

        {/* Billing Info */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Billing Information</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Period:</span>
              <span>
                {format(new Date(subscription.currentPeriodStart), "MMM dd")} -{" "}
                {format(
                  new Date(subscription.currentPeriodEnd),
                  "MMM dd, yyyy"
                )}
              </span>
            </div>
            {!subscription.cancelAtPeriodEnd && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Next Billing Date:
                </span>
                <span>
                  {format(
                    new Date(subscription.nextBillingDate),
                    "MMM dd, yyyy"
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* License Keys */}
        {subscription.licenseKeys && subscription.licenseKeys.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">License Keys</h4>
            {subscription.licenseKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between bg-muted p-3 rounded-md"
              >
                <div className="flex-1 min-w-0">
                  <code className="text-sm font-mono break-all">
                    {key.licenseKey}
                  </code>
                  <p className="text-xs text-muted-foreground mt-1">
                    {key.activationCount} / {key.maxTerminals} terminals
                    activated
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyLicenseKey(key.licenseKey)}
                  className="ml-2 flex-shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={handleManageBilling} className="flex-1">
            <ExternalLink className="h-4 w-4 mr-2" />
            Manage Billing
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
