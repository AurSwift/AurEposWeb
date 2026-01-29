"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
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
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { PlanCard } from "@/components/pricing/plan-card";
import { BillingToggle } from "@/components/pricing/billing-toggle";
import { type PlanId, type BillingCycle, type Plan } from "@/lib/stripe/plans";
import { VerificationPending } from "@/components/auth/verification-pending";

// Helper function to calculate annual savings
function calculateAnnualSavings(plan: Plan): number {
  const monthlyTotal = plan.priceMonthly * 12;
  return monthlyTotal - plan.priceAnnual;
}

type Step = "account" | "verification" | "plan" | "billing";

function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
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
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showVerificationSuccess, setShowVerificationSuccess] = useState(false);
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Fetch plans from API
  useEffect(() => {
    async function fetchPlans() {
      try {
        const response = await fetch("/api/subscriptions/plans");
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
      return;
    }

    // Check if user was redirected after email verification
    const stepParam = searchParams?.get("step");
    const verified = searchParams?.get("verified");
    if (stepParam === "plan" && verified === "true") {
      setStep("plan");
      setError(""); // Clear any errors

      // If user is logged in, show welcome message instead of verification message
      if (session?.user) {
        setShowWelcomeMessage(true);
        setTimeout(() => setShowWelcomeMessage(false), 5000);
      } else {
        // Only show verification message if not logged in (shouldn't happen in normal flow)
        setShowVerificationSuccess(true);
        setTimeout(() => setShowVerificationSuccess(false), 5000);
      }
    }
  }, [searchParams, session]);

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

      // Store email for verification pending screen
      setVerifiedEmail(formData.email);

      // Move to verification pending step (DO NOT auto-login)
      setStep("verification");
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
      const response = await fetch("/api/stripe/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: formData.planId,
          billingCycle: formData.billingCycle,
          email: verifiedEmail || formData.email, // Pass email for unauthenticated checkout
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

  // Render Verification Pending Step
  if (step === "verification") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/20 to-background relative overflow-hidden">
        {/* Decorative gradient orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />

        <div className="relative z-10 w-full max-w-lg flex items-center justify-center">
          <VerificationPending email={verifiedEmail} />
        </div>
      </div>
    );
  }

  // Render Account Step
  if (step === "account") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/20 to-background relative overflow-hidden">
        {/* Decorative gradient orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />

        <Card className="w-full max-w-lg relative z-10 shadow-xl border-border/50 backdrop-blur-sm">
          <CardHeader className="space-y-1 text-center pb-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Image
                src="/logo.png"
                alt="Aurswift Logo"
                width={40}
                height={40}
                className="h-10 w-13 object-cover"
                priority
              />
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Aurswift
              </CardTitle>
            </div>
            <CardDescription className="text-base">
              Create your account and start your free trial
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert
                variant="destructive"
                className="mb-6 animate-in fade-in-50"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleAccountSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-sm font-medium">
                  Company Name
                </Label>
                <Input
                  id="companyName"
                  type="text"
                  placeholder="Acme Retail Co."
                  value={formData.companyName}
                  onChange={(e) =>
                    setFormData({ ...formData, companyName: e.target.value })
                  }
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Work Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                    minLength={8}
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters
                </p>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={formData.agreeToTerms}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      agreeToTerms: checked as boolean,
                    })
                  }
                  className="mt-0.5"
                />
                <Label
                  htmlFor="terms"
                  className="text-sm leading-relaxed cursor-pointer"
                >
                  I agree to the{" "}
                  <Link
                    href="/terms"
                    className="text-primary hover:underline font-medium"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    className="text-primary hover:underline font-medium"
                  >
                    Privacy Policy
                  </Link>
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base font-medium"
                size="lg"
                disabled={isLoading || !formData.agreeToTerms}
              >
                {isLoading ? "Creating Account..." : "Continue"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground pt-2">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-primary hover:underline font-medium"
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
      <div className="min-h-screen py-12 px-4 bg-gradient-to-br from-background via-muted/20 to-background relative overflow-hidden">
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

          {showWelcomeMessage && session?.user && (
            <Alert className="mb-8 max-w-2xl mx-auto animate-in fade-in-50 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
              <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                <strong>
                  Welcome, {session.user.name || session.user.email}!
                </strong>{" "}
                Please select a plan to continue.
              </AlertDescription>
            </Alert>
          )}

          {showVerificationSuccess && !session?.user && (
            <Alert className="mb-8 max-w-2xl mx-auto animate-in fade-in-50 bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-sm text-green-800 dark:text-green-200">
                <strong>Email verified successfully!</strong> Please select a
                plan to continue.
              </AlertDescription>
            </Alert>
          )}

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
            <div className="grid md:grid-cols-3 gap-6 mb-10">
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
            <Button
              variant="ghost"
              onClick={() => setStep("account")}
              size="lg"
            >
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
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/20 to-background relative overflow-hidden">
          <Card className="w-full max-w-2xl relative z-10 shadow-xl border-border/50">
            <CardContent className="pt-6">
              <p className="text-muted-foreground mb-6 text-center">
                Plan not found. Please go back and select a plan.
              </p>
              <div className="flex justify-center">
                <Button onClick={() => setStep("plan")} size="lg">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Plans
                </Button>
              </div>
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
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/20 to-background relative overflow-hidden">
        {/* Decorative gradient orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />

        <Card className="w-full max-w-2xl relative z-10 shadow-xl border-border/50 backdrop-blur-sm">
          <CardHeader className="space-y-1 text-center pb-6">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Select Billing Cycle
            </CardTitle>
            <CardDescription className="text-base">
              Selected: {plan.name} Plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive" className="animate-in fade-in-50">
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
                  <span className="text-lg font-semibold">Annual Savings:</span>
                  <span className="text-lg font-bold">${savings}</span>
                </div>
              )}
              <div className="border-t border-border/50 pt-4 flex justify-between items-center">
                <span className="text-xl font-bold">Total:</span>
                <span className="text-2xl font-bold">${price}</span>
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep("plan")}
                className="flex-1 h-11"
                size="lg"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleCheckout}
                disabled={isLoading}
                className="flex-1 h-11 text-base font-medium"
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

export default function SignupPage() {
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
      <SignupPageContent />
    </Suspense>
  );
}
