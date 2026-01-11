"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showVerifiedMessage, setShowVerifiedMessage] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Check if redirected from email verification
  useEffect(() => {
    const verified = searchParams?.get("verified");
    const emailParam = searchParams?.get("email");

    if (verified === "true") {
      setShowVerifiedMessage(true);
      if (emailParam) {
        setEmail(decodeURIComponent(emailParam));
      }
      // Hide message after 10 seconds
      setTimeout(() => setShowVerifiedMessage(false), 10000);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        setIsLoading(false);
        return;
      }

      // Wait a moment for the session cookie to be set
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check if there's a callback URL (e.g., from email verification)
      const callbackUrl = searchParams?.get("callbackUrl");

      if (callbackUrl) {
        // Redirect to the callback URL (e.g., plan selection)
        window.location.href = decodeURIComponent(callbackUrl);
        return;
      }

      // Fetch session to check user role and redirect accordingly
      const response = await fetch("/api/auth/session");
      const session = await response.json();

      // Redirect based on role
      if (
        session?.user?.role === "admin" ||
        session?.user?.role === "support" ||
        session?.user?.role === "developer"
      ) {
        // Internal users go to admin dashboard
        window.location.href = "/admin";
      } else {
        // Customers go to customer dashboard
        window.location.href = "/dashboard";
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/20 to-background relative overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />

      <Card className="w-full max-w-md relative z-10 shadow-xl border-border/50 backdrop-blur-sm">
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
            Sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {showVerifiedMessage && (
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800 animate-in fade-in-50">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-sm text-green-800 dark:text-green-200">
                <strong>Email verified successfully!</strong>
                <br />
                Please log in to continue with your plan selection.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="animate-in fade-in-50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="demo@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Forgot password?
                </Link>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-11 text-base font-medium"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground pt-2">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-primary hover:underline font-medium"
            >
              Sign up
            </Link>
            {" • "}
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              Back to homepage
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/20 to-background">
          <Card className="w-full max-w-md shadow-xl border-border/50">
            <CardHeader className="space-y-1 text-center pb-6">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Image
                  src="/logo.png"
                  alt="Aurswift Logo"
                  width={40}
                  height={40}
                  className="h-10 w-10 object-cover"
                  priority
                />
                <CardTitle className="text-3xl font-bold">Aurswift</CardTitle>
              </div>
              <CardDescription className="text-base">
                Loading...
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
