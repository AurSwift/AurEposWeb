"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { PlanCard } from "@/components/pricing/plan-card";
import { BillingToggle } from "@/components/pricing/billing-toggle";
import { type PlanId, type BillingCycle, type Plan } from "@/lib/stripe/plans";

// Helper function to calculate annual savings
function calculateAnnualSavings(plan: Plan): number {
  const monthlyTotal = plan.priceMonthly * 12;
  return monthlyTotal - plan.priceAnnual;
}

type Step = "account" | "plan" | "billing";

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("account");
  const [plans, setPlans] = useState<Record<PlanId, Plan>>(
    {} as Record<PlanId, Plan>
  );
  const [plansLoading, setPlansLoading] = useState(true);
  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    password: "",
    planId: "" as PlanId | "",
    billingCycle: "monthly" as BillingCycle,
    agreeToTerms: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch plans from API
  useEffect(() => {
    async function fetchPlans() {
      try {
        const response = await fetch("/api/plans");
        const data = await response.json();
        if (data.plans) {
          setPlans(data.plans);
        }
      } catch (err) {
        console.error("Failed to fetch plans:", err);
        setError("Failed to load plans. Please refresh the page.");
      } finally {
        setPlansLoading(false);
      }
    }
    fetchPlans();
  }, []);

  useEffect(() => {
    // Check if user was redirected from canceled checkout
    const canceled = searchParams?.get("canceled");
    const plan = searchParams?.get("plan") as PlanId | null;
    if (canceled === "true" && plan) {
      setFormData((prev) => ({ ...prev, planId: plan }));
      setStep("plan");
      setError("Checkout was canceled. Please try again.");
    }
  }, [searchParams]);

  // Step 1: Account Creation
  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.companyName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Signup failed");
        return;
      }

      // Auto sign in
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Account created but sign in failed");
        return;
      }

      // Move to plan selection
      setStep("plan");
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Plan Selection
  const handlePlanSelect = (planId: PlanId) => {
    setFormData({ ...formData, planId });
    setStep("billing");
  };

  // Step 3: Billing Cycle & Checkout
  const handleCheckout = async () => {
    if (!formData.planId) {
      setError("Please select a plan");
      return;
    }

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
    } catch (err) {
      setError("Failed to start checkout");
    } finally {
      setIsLoading(false);
    }
  };

  // Render Account Step
  if (step === "account") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-light p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="space-y-1 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <span className="text-white font-bold text-lg">A</span>
              </div>
              <CardTitle className="text-2xl font-bold">Auraswif</CardTitle>
            </div>
            <CardDescription>
              Create your account and start your free trial
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleAccountSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  type="text"
                  placeholder="Acme Retail Co."
                  value={formData.companyName}
                  onChange={(e) =>
                    setFormData({ ...formData, companyName: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Work Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters
                </p>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="terms"
                  checked={formData.agreeToTerms}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      agreeToTerms: checked as boolean,
                    })
                  }
                />
                <Label
                  htmlFor="terms"
                  className="text-sm leading-relaxed cursor-pointer"
                >
                  I agree to the{" "}
                  <Link href="/terms" className="text-accent hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-accent hover:underline">
                    Privacy Policy
                  </Link>
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isLoading || !formData.agreeToTerms}
              >
                {isLoading ? "Creating Account..." : "Continue"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-accent hover:underline font-medium"
              >
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render Plan Selection Step
  if (step === "plan") {
    return (
      <div className="min-h-screen py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
            <p className="text-muted-foreground">
              Select the plan that best fits your business needs
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6 max-w-2xl mx-auto">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {plansLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading plans...</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {Object.values(plans).map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  billingCycle={formData.billingCycle}
                  onSelect={() => handlePlanSelect(plan.id)}
                  isSelected={formData.planId === plan.id}
                />
              ))}
            </div>
          )}

          <div className="text-center">
            <Button variant="ghost" onClick={() => setStep("account")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Render Billing Cycle Step
  if (step === "billing" && formData.planId) {
    const plan = plans[formData.planId];
    if (!plan) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-light p-4">
          <Card className="w-full max-w-2xl">
            <CardContent className="pt-6">
              <p className="text-muted-foreground mb-4">
                Plan not found. Please go back and select a plan.
              </p>
              <Button onClick={() => setStep("plan")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Plans
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    const price =
      formData.billingCycle === "monthly"
        ? plan.priceMonthly
        : plan.priceAnnual;
    const savings = calculateAnnualSavings(plan);

    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-light p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">
              Select Billing Cycle
            </CardTitle>
            <CardDescription>Selected: {plan.name} Plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <BillingToggle
              billingCycle={formData.billingCycle}
              onCycleChange={(cycle) =>
                setFormData({ ...formData, billingCycle: cycle })
              }
            />

            <div className="bg-muted p-6 rounded-lg space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Plan:</span>
                <span className="text-lg">{plan.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Billing:</span>
                <span className="text-lg capitalize">
                  {formData.billingCycle}
                </span>
              </div>
              {formData.billingCycle === "annual" && savings > 0 && (
                <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                  <span className="text-lg font-semibold">Annual Savings:</span>
                  <span className="text-lg font-bold">${savings}</span>
                </div>
              )}
              <div className="border-t pt-4 flex justify-between items-center">
                <span className="text-xl font-bold">Total:</span>
                <span className="text-2xl font-bold">${price}</span>
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => setStep("plan")}
                className="flex-1"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleCheckout}
                disabled={isLoading}
                className="flex-1"
                size="lg"
              >
                {isLoading ? "Processing..." : "Proceed to Payment"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
