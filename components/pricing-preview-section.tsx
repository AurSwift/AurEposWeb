"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check } from "lucide-react";
import type { PlanId } from "@/lib/stripe/plans";

interface Plan {
  id: PlanId;
  name: string;
  description: string;
  priceMonthly: number;
  priceAnnual: number;
  features: {
    features: string[];
  };
  popular?: boolean;
}

export function PricingPreviewSection() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    "monthly"
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPlans() {
      try {
        const response = await fetch("/api/plans");
        const data = await response.json();
        if (data.plans) {
          // Convert plans object to array and sort by plan order
          const plansArray = Object.values(data.plans) as Plan[];
          // Sort: basic, professional, enterprise
          const planOrder: PlanId[] = ["basic", "professional", "enterprise"];
          plansArray.sort((a, b) => {
            return planOrder.indexOf(a.id) - planOrder.indexOf(b.id);
          });
          setPlans(plansArray);
        }
      } catch (error) {
        console.error("Failed to fetch plans:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, []);

  if (loading) {
    return (
      <section id="pricing" className="py-20 sm:py-28 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl text-balance">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg text-muted-foreground text-balance">
              Choose the plan that&apos;s right for your business
            </p>
          </div>
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading plans...</p>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section id="pricing" className="py-20 sm:py-28 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl text-balance">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground text-balance">
            Choose the plan that&apos;s right for your business
          </p>
        </div>
        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center mb-12">
          <div className="flex items-center gap-2 p-1.5 bg-muted/50 rounded-lg border border-border">
            <Button
              type="button"
              variant={billingCycle === "monthly" ? "default" : "ghost"}
              size="lg"
              onClick={() => setBillingCycle("monthly")}
              className={`font-semibold transition-all ${
                billingCycle === "monthly"
                  ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              Monthly
            </Button>
            <Button
              type="button"
              variant={billingCycle === "annual" ? "default" : "ghost"}
              size="lg"
              onClick={() => setBillingCycle("annual")}
              className={`font-semibold transition-all ${
                billingCycle === "annual"
                  ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              Annual
              <span className="ml-2 text-xs font-bold px-1.5 py-0.5 rounded bg-primary-foreground/20 text-primary-foreground">
                Save 20%
              </span>
            </Button>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const price =
              billingCycle === "monthly" ? plan.priceMonthly : plan.priceAnnual;
            const period = billingCycle === "monthly" ? "/month" : "/year";
            const isPopular = plan.popular;

            return (
              <Card
                key={plan.id}
                className={
                  isPopular
                    ? "border-2 border-secondary shadow-xl relative"
                    : "border-border"
                }
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-secondary text-secondary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                <CardHeader className="text-center pb-8">
                  <CardTitle className="text-2xl font-bold">
                    {plan.name}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {plan.description}
                  </CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">
                      ${price}
                    </span>
                    <span className="text-muted-foreground">{period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {plan.features.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
                        <span className="text-sm text-card-foreground">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isPopular ? "default" : "outline"}
                    asChild
                  >
                    <Link
                      href={
                        isAuthenticated
                          ? `/pricing?plan=${plan.id}&cycle=${billingCycle}`
                          : `/signup?plan=${plan.id}&cycle=${billingCycle}`
                      }
                    >
                      Select Plan
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
        <div className="mt-12 text-center">
          <Button variant="link" asChild>
            <Link href="/pricing" className="text-secondary">
              See full pricing details →
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
