"use client";

import { useState, useEffect } from "react";
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
import { BillingToggle } from "./billing-toggle";
import type { Plan, BillingCycle, PlanId } from "@/lib/stripe/plans";

interface PlanCardProps {
  plan: Plan;
  billingCycle: "monthly" | "annual";
  onSelect: (planId: PlanId, cycle: BillingCycle) => void;
  isSelected?: boolean;
  selectedBillingCycle?: BillingCycle | null;
}

export function PlanCard({
  plan,
  billingCycle,
  onSelect,
  isSelected,
  selectedBillingCycle,
}: PlanCardProps) {
  const [localBillingCycle, setLocalBillingCycle] =
    useState<BillingCycle>(billingCycle);

  // Sync local billing cycle with global when plan is selected
  useEffect(() => {
    if (isSelected && selectedBillingCycle) {
      setLocalBillingCycle(selectedBillingCycle);
    }
  }, [isSelected, selectedBillingCycle]);

  // Sync with global billing cycle when it changes (for initial state)
  useEffect(() => {
    setLocalBillingCycle(billingCycle);
  }, [billingCycle]);

  const isThisPlanSelected = isSelected && selectedBillingCycle === localBillingCycle;

  const price =
    localBillingCycle === "monthly" ? plan.priceMonthly : plan.priceAnnual;
  const savings =
    localBillingCycle === "annual"
      ? plan.priceMonthly * 12 - plan.priceAnnual
      : 0;

  const handleBillingCycleChange = (cycle: BillingCycle) => {
    setLocalBillingCycle(cycle);
    // Auto-select plan when billing cycle changes if this plan is already selected
    if (isSelected) {
      onSelect(plan.id, cycle);
    }
  };

  const handleSelect = () => {
    onSelect(plan.id, localBillingCycle);
  };

  return (
    <Card
      className={`relative transition-all ${
        isThisPlanSelected ? "border-primary border-2 shadow-lg" : ""
      } ${plan.popular ? "border-accent" : ""}`}
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
            /{localBillingCycle === "monthly" ? "month" : "year"}
          </span>
          {savings > 0 && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              Save ${savings} per year
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <BillingToggle
          billingCycle={localBillingCycle}
          onCycleChange={handleBillingCycleChange}
        />
        <ul className="space-y-2">
          {plan.features.features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
        <Button
          onClick={handleSelect}
          className="w-full"
          variant={plan.popular || isThisPlanSelected ? "default" : "outline"}
        >
          {isThisPlanSelected ? "Selected" : "Select Plan"}
        </Button>
      </CardContent>
    </Card>
  );
}

