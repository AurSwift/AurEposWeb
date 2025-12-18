import { DashboardHeader } from "@/components/dashboard-header"
import { WelcomeBanner } from "@/components/welcome-banner"
import { SubscriptionCard } from "@/components/subscription-card"
import { LicenseKeyCard } from "@/components/license-key-card"
import { PaymentMethodCard } from "@/components/payment-method-card"
import { DownloadCard } from "@/components/download-card"
import { QuickLinksCard } from "@/components/quick-links-card"

export default function DashboardPage() {
  // Mock user data
  const userData = {
    companyName: "Acme Retail Co.",
    subscription: {
      plan: "Pro Plan",
      status: "Active",
      nextBillingDate: "2025-01-15",
    },
    licenseKey: "AURA-4B2F-8K9M-3P7Q",
    paymentMethod: {
      lastFour: "4242",
      expiry: "12/26",
    },
  }

  return (
    <div className="min-h-screen bg-neutral-light">
      <DashboardHeader companyName={userData.companyName} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <WelcomeBanner companyName={userData.companyName} />

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <SubscriptionCard subscription={userData.subscription} />
          <LicenseKeyCard licenseKey={userData.licenseKey} />
          <PaymentMethodCard paymentMethod={userData.paymentMethod} />
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <DownloadCard />
          <QuickLinksCard />
        </div>
      </main>
    </div>
  )
}

