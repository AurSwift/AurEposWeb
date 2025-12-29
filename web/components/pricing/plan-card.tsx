"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import type { Plan } from "@/lib/stripe/plans";

interface PlanCardProps {
  plan: Plan;
  billingCycle: "monthly" | "annual";
  onSelect: () => void;
  isSelected?: boolean;
}

export function PlanCard({
  plan,
  billingCycle,
  onSelect,
  isSelected,
}: PlanCardProps) {
  const price =
    billingCycle === "monthly" ? plan.priceMonthly : plan.priceAnnual;
  const savings =
    billingCycle === "annual"
      ? plan.priceMonthly * 12 - plan.priceAnnual
      : 0;

  return (
    <Card
      className={`relative ${isSelected ? "border-primary border-2" : ""} ${
        plan.popular ? "border-accent" : ""
      }`}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-accent text-accent-foreground">Most Popular</Badge>
        </div>
      )}
      <CardHeader>
        <CardTitle className="text-2xl">{plan.name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
        <div className="mt-4">
          <span className="text-4xl font-bold">${price}</span>
          <span className="text-muted-foreground">
            /{billingCycle === "monthly" ? "month" : "year"}
          </span>
          {savings > 0 && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              Save ${savings} per year
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 mb-6">
          {plan.features.features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
        <Button
          onClick={onSelect}
          className="w-full"
          variant={plan.popular || isSelected ? "default" : "outline"}
        >
          Select Plan
        </Button>
      </CardContent>
    </Card>
  );
}

