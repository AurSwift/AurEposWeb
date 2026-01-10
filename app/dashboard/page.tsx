import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { WelcomeBanner } from "@/components/welcome-banner";
import { SubscriptionCard } from "@/components/subscription-card";
import { LicenseKeyCard } from "@/components/license-key-card";
import { PaymentMethodCard } from "@/components/payment-method-card";
import { DownloadCard } from "@/components/download-card";
import { QuickLinksCard } from "@/components/quick-links-card";
import { InvoiceHistory } from "@/components/invoice-history";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/lib/db";
import { customers, subscriptions, licenseKeys } from "@/lib/db/schema";
import { eq, desc, and, or } from "drizzle-orm";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // 🔒 RBAC: Internal users should use /admin dashboard
  if (
    session.user.role === "admin" ||
    session.user.role === "support" ||
    session.user.role === "developer"
  ) {
    redirect("/admin");
  }

  // Fetch all necessary data in parallel (customers only)
  const [customerResult] = await db
    .select()
    .from(customers)
    .where(eq(customers.userId, session.user.id))
    .limit(1);

  if (!customerResult) {
    // Customer user without customer record - data integrity issue
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-destructive">
            Account Setup Required
          </h2>
          <p className="text-muted-foreground mt-2">
            Your account is missing required customer information. Please
            contact support.
          </p>
        </div>
      </main>
    );
  }

  const customer = customerResult;

  // Check if customer has been deleted (soft delete)
  if (customer.status === "deleted") {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-destructive/10 border-2 border-destructive/50 rounded-lg p-8 text-center">
            <div className="mb-4">
              <svg
                className="mx-auto h-16 w-16 text-destructive"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-3">
              Account Deleted
            </h2>

            <p className="text-muted-foreground mb-6 leading-relaxed">
              Your customer account has been deleted.
              <br />
              <br />
              <span className="font-semibold">What this means:</span>
            </p>

            <ul className="text-left text-muted-foreground space-y-2 mb-6 max-w-md mx-auto">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>All subscriptions have been cancelled</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>License keys have been revoked</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Access to software downloads has been removed</span>
              </li>
            </ul>

            <div className="space-y-3">
              <a
                href="/support"
                className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
              >
                Contact Support
              </a>
              <br />
              <a
                href="/pricing"
                className="inline-block px-6 py-3 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors font-medium"
              >
                Create New Subscription
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Get active subscription
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.customerId, customer.id),
        or(
          eq(subscriptions.status, "active"),
          eq(subscriptions.status, "trialing"),
          eq(subscriptions.status, "past_due"),
          eq(subscriptions.status, "cancelled") // Include cancelled to show status
        )
      )
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  // Get license key - prioritize active licenses, then newest
  const [licenseKeyResult] = await db
    .select()
    .from(licenseKeys)
    .where(eq(licenseKeys.customerId, customer.id))
    .orderBy(desc(licenseKeys.isActive), desc(licenseKeys.createdAt))
    .limit(1);

  const licenseKey = licenseKeyResult?.licenseKey || "Not Assigned";

  // Prepare subscription data for the card
  const subscriptionData = subscription
    ? {
        planId: subscription.planId || undefined,
        plan:
          (subscription.planId || "Unknown").charAt(0).toUpperCase() +
          (subscription.planId || "Unknown").slice(1),
        status:
          (subscription.status || "Inactive").charAt(0).toUpperCase() +
          (subscription.status || "inactive").slice(1),
        nextBillingDate: subscription.nextBillingDate || null,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
        trialEnd: subscription.trialEnd,
        price: subscription.price || undefined,
        billingCycle: subscription.billingCycle || undefined,
      }
    : {
        plan: "No Active Plan",
        status: "Inactive",
        nextBillingDate: null,
      };

  const hasActiveSubscription =
    subscription &&
    (subscription.status === "active" || subscription.status === "trialing");

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <WelcomeBanner
        companyName={customer.companyName || session.user.name || "User"}
      />

      {/* Show call-to-action if no active subscription */}
      {!hasActiveSubscription && (
        <div className="mt-6 p-6 bg-primary/10 border border-primary/20 rounded-lg">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Get Started with Your AurEPOS
              </h3>
              <p className="text-sm text-muted-foreground">
                Select a subscription plan to activate your license and begin
                using the software.
              </p>
            </div>
            <a
              href="/pricing"
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium whitespace-nowrap"
            >
              Select a Plan
            </a>
          </div>
        </div>
      )}

      <Tabs defaultValue="overview" className="mt-8 space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-[400px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <SubscriptionCard subscription={subscriptionData} />
            <LicenseKeyCard licenseKey={licenseKey} />
            <PaymentMethodCard />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <DownloadCard subscriptionStatus={subscription?.status} />
            <QuickLinksCard />
          </div>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <h2 className="text-2xl font-bold">Payment Method</h2>
          <div className="max-w-md">
            <PaymentMethodCard />
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
          <h2 className="text-2xl font-bold">Billing History</h2>
          <InvoiceHistory />
        </TabsContent>
      </Tabs>
    </main>
  );
}
