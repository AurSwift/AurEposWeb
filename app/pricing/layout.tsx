import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing Plans - AuraSwift",
  description:
    "Choose the perfect plan for your business. Basic and Professional plans available with flexible monthly or annual billing options.",
  keywords: [
    "pricing",
    "plans",
    "subscription",
    "basic plan",
    "professional plan",
    "pos system",
    "terminal management",
  ],
  openGraph: {
    title: "AuraSwift Pricing Plans",
    description:
      "Flexible pricing plans for businesses of all sizes. Choose monthly or annual billing and scale as you grow.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AuraSwift Pricing Plans",
    description:
      "Flexible pricing plans for businesses of all sizes. Choose monthly or annual billing and scale as you grow.",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

