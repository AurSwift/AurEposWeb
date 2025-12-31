"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubscriptionDetails } from "@/components/dashboard/subscription-details";
import { SubscriptionActions } from "@/components/dashboard/subscription-actions";
import { PaymentHistory } from "@/components/dashboard/payment-history";

export default function SubscriptionPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUpdate = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

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
        <h1 className="text-3xl font-bold mb-2">Subscription Management</h1>
        <p className="text-muted-foreground">
          Manage your plan, billing details, and view payment history.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">Current Plan</h2>
            <SubscriptionDetails refreshTrigger={refreshTrigger} />
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Payment History</h2>
            </div>
            <PaymentHistory />
          </section>
        </div>

        <div className="space-y-6">
          <div className="p-6 border rounded-lg bg-card shadow-sm space-y-4">
            <h3 className="font-semibold text-lg">Plan Actions</h3>
            <p className="text-sm text-muted-foreground">
              Upgrade, downgrade, or cancel your subscription.
            </p>
            <SubscriptionActions onUpdate={handleUpdate} />
          </div>
        </div>
      </div>
    </div>
  );
}
