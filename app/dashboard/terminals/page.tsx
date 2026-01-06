"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Terminal,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface TerminalActivation {
  id: string;
  licenseKey: string;
  terminalName: string | null;
  machineIdHash: string | null;
  firstActivation: Date;
  lastHeartbeat: Date | null;
  isActive: boolean;
  ipAddress: string | null;
  location: {
    city?: string;
    country?: string;
  } | null;
}

interface LicenseKeyInfo {
  licenseKey: string;
  maxTerminals: number;
  activationCount: number;
}

export default function TerminalsPage() {
  const [activations, setActivations] = useState<TerminalActivation[]>([]);
  const [licenseKeyInfo, setLicenseKeyInfo] = useState<LicenseKeyInfo | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTerminals();
  }, []);

  const fetchTerminals = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/terminals", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch terminals");
      }

      setActivations(data.activations || []);
      setLicenseKeyInfo(data.licenseKeyInfo || null);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch terminals"
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (isActive: boolean, lastHeartbeat: Date | null) => {
    if (!isActive) {
      return <Badge variant="outline">Inactive</Badge>;
    }

    if (!lastHeartbeat) {
      return <Badge variant="secondary">Never Connected</Badge>;
    }

    const now = new Date();
    const heartbeatTime = new Date(lastHeartbeat);
    const minutesSinceHeartbeat = Math.floor(
      (now.getTime() - heartbeatTime.getTime()) / 1000 / 60
    );

    if (minutesSinceHeartbeat < 5) {
      return (
        <Badge variant="default" className="bg-green-600">
          Online
        </Badge>
      );
    } else if (minutesSinceHeartbeat < 60) {
      return <Badge variant="secondary">Idle</Badge>;
    } else {
      return <Badge variant="destructive">Offline</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading terminals...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4">
        <div className="text-center py-12">
          <p className="text-destructive">{error}</p>
          <Button onClick={fetchTerminals} className="mt-4" variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold mb-2">Terminal Management</h1>
        <p className="text-muted-foreground">
          View and manage your activated terminals.
        </p>
      </div>

      {licenseKeyInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              License Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  License Key:
                </span>
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {licenseKeyInfo.licenseKey}
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Terminals:
                </span>
                <span className="text-sm font-medium">
                  {licenseKeyInfo.activationCount} /{" "}
                  {licenseKeyInfo.maxTerminals} activated
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Activated Terminals</CardTitle>
        </CardHeader>
        <CardContent>
          {activations.length === 0 ? (
            <div className="text-center py-12">
              <Terminal className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No terminals activated yet
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Activate your first terminal using your license key in the POS
                application.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activations.map((activation) => (
                <div
                  key={activation.id}
                  className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Terminal className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold">
                          {activation.terminalName || "Unnamed Terminal"}
                        </h3>
                        {getStatusBadge(
                          activation.isActive,
                          activation.lastHeartbeat
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">
                            First Activated
                          </p>
                          <p className="font-medium">
                            {format(
                              new Date(activation.firstActivation),
                              "MMM dd, yyyy HH:mm"
                            )}
                          </p>
                        </div>
                        {activation.lastHeartbeat && (
                          <div>
                            <p className="text-muted-foreground">
                              Last Heartbeat
                            </p>
                            <p className="font-medium">
                              {format(
                                new Date(activation.lastHeartbeat),
                                "MMM dd, yyyy HH:mm"
                              )}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Technical Details - Collapsed by default */}
                      <details className="mt-4 group">
                        <summary className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                          <svg
                            className="h-4 w-4 transition-transform group-open:rotate-90"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                          Technical Details
                        </summary>
                        <div className="mt-3 ml-6 grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Machine ID</p>
                            <p className="font-mono text-xs break-all opacity-70">
                              {activation.machineIdHash?.substring(0, 16)}...
                            </p>
                          </div>
                          {activation.ipAddress && (
                            <div>
                              <p className="text-muted-foreground">
                                IP Address
                              </p>
                              <p className="font-mono text-xs opacity-70">
                                {activation.ipAddress}
                              </p>
                            </div>
                          )}
                          {activation.location &&
                            (activation.location.city ||
                              activation.location.country) && (
                              <div>
                                <p className="text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  Location
                                </p>
                                <p className="text-xs opacity-70">
                                  {activation.location.city &&
                                  activation.location.country
                                    ? `${activation.location.city}, ${activation.location.country}`
                                    : activation.location.country ||
                                      activation.location.city ||
                                      "Unknown"}
                                </p>
                              </div>
                            )}
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
