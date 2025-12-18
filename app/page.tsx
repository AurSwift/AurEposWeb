import { Header } from "@/components/header"
import { HeroSection } from "@/components/hero-section"
import { FeaturesSection } from "@/components/features-section"
import { SocialProofSection } from "@/components/social-proof-section"
import { PricingPreviewSection } from "@/components/pricing-preview-section"
import { CTASection } from "@/components/cta-section"
import { Footer } from "@/components/footer"

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <HeroSection />
        <SocialProofSection />
        <FeaturesSection />
        <PricingPreviewSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}
