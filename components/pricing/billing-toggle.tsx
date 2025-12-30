"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BillingToggleProps {
  billingCycle: "monthly" | "annual";
  onCycleChange: (cycle: "monthly" | "annual") => void;
}

export function BillingToggle({
  billingCycle,
  onCycleChange,
}: BillingToggleProps) {
  return (
    <div className="flex items-center justify-center gap-2 p-1.5 bg-muted/50 rounded-lg border border-border">
      <Button
        type="button"
        variant={billingCycle === "monthly" ? "default" : "ghost"}
        size="lg"
        onClick={() => onCycleChange("monthly")}
        className={cn(
          "flex-1 font-semibold transition-all",
          billingCycle === "monthly"
            ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        Monthly
      </Button>
      <Button
        type="button"
        variant={billingCycle === "annual" ? "default" : "ghost"}
        size="lg"
        onClick={() => onCycleChange("annual")}
        className={cn(
          "flex-1 font-semibold transition-all",
          billingCycle === "annual"
            ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        Annual
        <span
          className={cn(
            "ml-2 text-xs font-bold px-1.5 py-0.5 rounded",
            billingCycle === "annual"
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-green-500/20 text-green-700 dark:text-green-400"
          )}
        >
          Save 20%
        </span>
      </Button>
    </div>
  );
}

