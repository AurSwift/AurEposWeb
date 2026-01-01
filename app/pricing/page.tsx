"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, ArrowRight } from "lucide-react";
import { PlanCard } from "@/components/pricing/plan-card";
import { type PlanId, type BillingCycle, type Plan } from "@/lib/stripe/plans";
import { useSession } from "next-auth/react";

// Helper function to calculate annual savings
function calculateAnnualSavings(plan: Plan): number {
  const monthlyTotal = plan.priceMonthly * 12;
  return monthlyTotal - plan.priceAnnual;
}

function PricingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [plans, setPlans] = useState<Record<PlanId, Plan>>(
    {} as Record<PlanId, Plan>
  );
  const [plansLoading, setPlansLoading] = useState(true);
  const [formData, setFormData] = useState({
    planId: "" as PlanId | "",
    billingCycle: "monthly" as BillingCycle,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Handle query parameters from URL (from home page pricing section)
  useEffect(() => {
    const planParam = searchParams?.get("plan") as PlanId | null;
    const cycleParam = searchParams?.get("cycle") as BillingCycle | null;

    if (
      planParam &&
      (planParam === "basic" ||
        planParam === "professional" ||
        planParam === "enterprise")
    ) {
      setFormData((prev) => ({
        ...prev,
        planId: planParam,
        billingCycle: cycleParam === "annual" ? "annual" : "monthly",
      }));
    }
  }, [searchParams]);

  // Fetch plans from API
  useEffect(() => {
    async function fetchPlans() {
      try {
        const response = await fetch("/api/plans");
        const data = await response.json();
        if (data.plans) {
          setPlans(data.plans);
        }
      } catch {
        setError("Failed to load plans. Please refresh the page.");
      } finally {
        setPlansLoading(false);
      }
    }
    fetchPlans();
  }, []);

  // Handle plan selection with billing cycle
  const handlePlanSelect = (planId: PlanId, billingCycle: BillingCycle) => {
    setFormData({ ...formData, planId, billingCycle });
  };

  // Handle checkout
  const handleCheckout = async () => {
    if (!formData.planId) {
      setError("Please select a plan");
      return;
    }

    // If user is not logged in, redirect to signup with plan selected
    if (status === "unauthenticated") {
      router.push(`/signup?step=plan&plan=${formData.planId}`);
      return;
    }

    // If user is logged in, proceed to checkout
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: formData.planId,
          billingCycle: formData.billingCycle,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create checkout");
        return;
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("Failed to start checkout");
    } finally {
      setIsLoading(false);
    }
  };

  const plan = formData.planId ? plans[formData.planId] : null;
  const price = plan
    ? formData.billingCycle === "monthly"
      ? plan.priceMonthly
      : plan.priceAnnual
    : 0;
  const savings = plan ? calculateAnnualSavings(plan) : 0;

  return (
    <div className="min-h-screen">
      <Header />
      <div className="py-12 px-4 bg-gradient-to-br from-background via-muted/20 to-background relative overflow-hidden">
        {/* Decorative gradient orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Choose Your Plan
            </h1>
            <p className="text-muted-foreground text-lg">
              Select the plan that best fits your business needs
            </p>
          </div>

          {error && (
            <Alert
              variant="destructive"
              className="mb-8 max-w-2xl mx-auto animate-in fade-in-50"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {plansLoading ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg">Loading plans...</p>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-3 gap-6 mb-10">
                {Object.values(plans).map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    billingCycle={formData.billingCycle}
                    onSelect={handlePlanSelect}
                    isSelected={formData.planId === plan.id}
                    selectedBillingCycle={
                      formData.planId === plan.id ? formData.billingCycle : null
                    }
                  />
                ))}
              </div>

              {!formData.planId && (
                <div className="text-center">
                  <p className="text-muted-foreground">
                    Select a plan and billing cycle above to continue
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Review Selection Modal */}
      {formData.planId && plan && (
        <Dialog
          open={!!formData.planId}
          onOpenChange={(open) => {
            if (!open) {
              setFormData({ ...formData, planId: "" as PlanId | "" });
            }
          }}
        >
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">
                Review Your Selection
              </DialogTitle>
              <DialogDescription className="text-base">
                {plan.name} Plan •{" "}
                {formData.billingCycle === "monthly" ? "Monthly" : "Annual"}{" "}
                Billing
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="bg-muted/50 backdrop-blur-sm p-6 rounded-xl border border-border/50 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Plan:</span>
                  <span className="text-lg font-medium">{plan.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Billing:</span>
                  <span className="text-lg capitalize font-medium">
                    {formData.billingCycle}
                  </span>
                </div>
                {formData.billingCycle === "annual" && savings > 0 && (
                  <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                    <span className="text-lg font-semibold">
                      Annual Savings:
                    </span>
                    <span className="text-lg font-bold">${savings}</span>
                  </div>
                )}
                <div className="border-t border-border/50 pt-4 flex justify-between items-center">
                  <span className="text-xl font-bold">Total:</span>
                  <span className="text-2xl font-bold">${price}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleCheckout}
                  disabled={isLoading}
                  className="w-full h-11 text-base font-medium"
                  size="lg"
                >
                  {isLoading
                    ? "Processing..."
                    : status === "unauthenticated"
                    ? "Sign Up to Continue"
                    : "Proceed to Payment"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  onClick={() =>
                    setFormData({ ...formData, planId: "" as PlanId | "" })
                  }
                  className="w-full"
                >
                  Change Selection
                </Button>
              </div>

              {status === "unauthenticated" && (
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    className="text-primary hover:underline font-medium"
                  >
                    Sign in
                  </Link>
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Footer />
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/20 to-background relative overflow-hidden">
          <Card className="w-full max-w-lg relative z-10 shadow-xl border-border/50">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <PricingPageContent />
    </Suspense>
  );
}
