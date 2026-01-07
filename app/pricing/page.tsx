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
import { PricingStructuredData } from "@/components/pricing/structured-data";
import { type PlanId, type BillingCycle, type Plan } from "@/lib/stripe/plans";
import { calculateAnnualSavings } from "@/lib/stripe/plan-utils";
import { useSession } from "next-auth/react";

function PricingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [plans, setPlans] = useState<Record<PlanId, Plan>>(
    {} as Record<PlanId, Plan>
  );
  const [plansLoading, setPlansLoading] = useState(true);
  const [formData, setFormData] = useState<{
    planId: PlanId | null;
    billingCycle: BillingCycle;
  }>({
    planId: null,
    billingCycle: "monthly",
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

  // Fetch plans from API with retry logic
  useEffect(() => {
    async function fetchPlans(retries = 3, delay = 1000) {
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const response = await fetch("/api/subscriptions/plans");
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          // Validate response structure
          if (!data.plans || typeof data.plans !== "object") {
            throw new Error("Invalid response format");
          }
          
          // Basic validation of plan structure
          const planIds: PlanId[] = ["basic", "professional", "enterprise"];
          for (const planId of planIds) {
            if (!data.plans[planId]) {
              console.warn(`Missing plan: ${planId}`);
            }
          }
          
          setPlans(data.plans);
          setError("");
          setPlansLoading(false); // Mark loading as complete on success
          return;
        } catch (err) {
          console.error(`Attempt ${attempt + 1} failed:`, err);
          
          if (attempt === retries - 1) {
            setError("Failed to load plans. Please refresh the page.");
            setPlansLoading(false); // Mark loading as complete on final failure
          } else {
            // Exponential backoff
            await new Promise((resolve) =>
              setTimeout(resolve, delay * Math.pow(2, attempt))
            );
          }
        }
      }
    }
    
    fetchPlans();
  }, []);

  // Handle plan selection with billing cycle
  const handlePlanSelect = (planId: PlanId, billingCycle: BillingCycle) => {
    setFormData({ ...formData, planId, billingCycle });
    
    // Track selection event (if analytics is available)
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "plan_selected", {
        plan_id: planId,
        billing_cycle: billingCycle,
        price:
          plans[planId]?.[
            billingCycle === "monthly" ? "priceMonthly" : "priceAnnual"
          ],
      });
    }
  };

  // Handle checkout with validation
  const handleCheckout = async () => {
    // Validate plan selection
    if (!formData.planId) {
      setError("Please select a plan");
      return;
    }

    // Validate plan exists
    if (!plans[formData.planId]) {
      setError("Invalid plan selected");
      return;
    }

    // Validate price is positive
    const price =
      formData.billingCycle === "monthly"
        ? plans[formData.planId].priceMonthly
        : plans[formData.planId].priceAnnual;

    if (price <= 0) {
      setError("Invalid plan pricing");
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
      const response = await fetch("/api/stripe/checkout/create", {
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
        // Track checkout initiation
        if (typeof window !== "undefined" && (window as any).gtag) {
          (window as any).gtag("event", "begin_checkout", {
            plan_id: formData.planId,
            billing_cycle: formData.billingCycle,
            value: price,
          });
        }
        
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
      {/* Add structured data for SEO */}
      {Object.keys(plans).length > 0 && <PricingStructuredData plans={plans} />}
      
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
          ) : Object.keys(plans).length === 0 ? (
            <div className="text-center py-16">
              <Card className="max-w-lg mx-auto">
                <CardContent className="pt-6">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">No Plans Available</h3>
                  <p className="text-muted-foreground mb-4">
                    We couldn't load our pricing plans. Please try again later.
                  </p>
                  <Button onClick={() => window.location.reload()}>
                    Refresh Page
                  </Button>
                </CardContent>
              </Card>
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
              setFormData({ ...formData, planId: null });
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
                  onClick={() => setFormData({ ...formData, planId: null })}
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

// Separate the Suspense wrapper for the search params hook
function PricingPageWithSuspense() {
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

export default PricingPageWithSuspense;
