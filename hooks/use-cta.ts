import { useSession } from "next-auth/react";

export interface CTAConfig {
  primaryButton: {
    text: string;
    href: string;
  };
  secondaryButton?: {
    text: string;
    href: string;
  };
  heading: string;
  description: string;
}

export function useCTA(): CTAConfig {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  if (isAuthenticated) {
    return {
      primaryButton: {
        text: "Select a Plan",
        href: "/pricing",
      },
      secondaryButton: {
        text: "Go to Dashboard",
        href: "/dashboard",
      },
      heading: "Ready to Get Started?",
      description:
        "Select a subscription plan to activate your account and receive your license key.",
    };
  }

  return {
    primaryButton: {
      text: "Start Free Trial",
      href: "/signup",
    },
    secondaryButton: {
      text: "View Plans",
      href: "/pricing",
    },
    heading: "Ready to Streamline Your Business?",
    description:
      "Get started in minutes. No credit card required for your free trial.",
  };
}

