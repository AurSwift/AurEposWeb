import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { WelcomeBanner } from "@/components/welcome-banner";
import { SubscriptionCard } from "@/components/subscription-card";
import { LicenseKeyCard } from "@/components/license-key-card";
import { PaymentMethodCard } from "@/components/payment-method-card";
import { DownloadCard } from "@/components/download-card";
import { QuickLinksCard } from "@/components/quick-links-card";
import { db } from "@/lib/db";
import { customers, subscriptions, licenseKeys } from "@/lib/db/schema";
import { eq, desc, and, or } from "drizzle-orm";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Fetch all necessary data in parallel
  const [customerResult] = await db
    .select()
    .from(customers)
    .where(eq(customers.userId, session.user.id))
    .limit(1);

  if (!customerResult) {
    // If no customer, something is wrong, redirect or show error
    redirect("/login");
  }

  const customer = customerResult;

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

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <SubscriptionCard subscription={subscriptionData} />
        <LicenseKeyCard licenseKey={licenseKey} />
        <PaymentMethodCard />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <DownloadCard />
        <QuickLinksCard />
      </div>
    </main>
  );
}
