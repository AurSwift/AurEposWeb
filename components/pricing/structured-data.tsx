import type { Plan, PlanId } from "@/lib/stripe/plans";

interface PricingStructuredDataProps {
  plans: Record<PlanId, Plan>;
}

/**
 * Generate JSON-LD structured data for pricing plans
 * This helps search engines understand our pricing and display rich results
 */
export function PricingStructuredData({ plans }: PricingStructuredDataProps) {
  const offers = Object.values(plans).flatMap((plan) => [
    // Monthly offer
    {
      "@type": "Offer",
      name: `${plan.name} Plan - Monthly`,
      description: plan.description,
      price: plan.priceMonthly.toString(),
      priceCurrency: "USD",
      billingDuration: "P1M", // ISO 8601 duration: 1 month
      availability: "https://schema.org/InStock",
      url: `https://aurswift.com/pricing?plan=${plan.id}&cycle=monthly`,
    },
    // Annual offer
    {
      "@type": "Offer",
      name: `${plan.name} Plan - Annual`,
      description: `${plan.description} (Save ${plan.annualDiscountPercent}% with annual billing)`,
      price: plan.priceAnnual.toString(),
      priceCurrency: "USD",
      billingDuration: "P1Y", // ISO 8601 duration: 1 year
      availability: "https://schema.org/InStock",
      url: `https://aurswift.com/pricing?plan=${plan.id}&cycle=annual`,
    },
  ]);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "AurSwift EPOS System",
    description:
      "Modern point-of-sale and terminal management system with flexible pricing plans",
    brand: {
      "@type": "Brand",
      name: "AurSwift",
    },
    offers: {
      "@type": "AggregateOffer",
      offerCount: offers.length,
      lowPrice: Math.min(
        ...Object.values(plans).map((p) => p.priceMonthly)
      ).toString(),
      highPrice: Math.max(
        ...Object.values(plans).map((p) => p.priceAnnual)
      ).toString(),
      priceCurrency: "USD",
      offers,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
