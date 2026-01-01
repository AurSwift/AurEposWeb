"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2,
  AlertCircle,
  Mail,
  Loader2,
  ArrowRight,
} from "lucide-react";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");

  const [status, setStatus] = useState<
    "verifying" | "success" | "error" | "already-verified" | "no-token"
  >("verifying");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("no-token");
      return;
    }

    verifyEmail(token);
  }, [token]);

  const verifyEmail = async (verificationToken: string) => {
    try {
      const response = await fetch(
        `/api/auth/verify-email?token=${verificationToken}`
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Verification failed");
        setStatus("error");
        return;
      }

      // Check if already verified
      if (data.alreadyVerified) {
        setStatus("already-verified");
        setEmail(data.email);
        return;
      }

      // Email verified successfully
      setEmail(data.email);
      setStatus("success");

      // Redirect to plan selection after email verification
      // In a real-world EPOS flow, users should select a plan before accessing the dashboard
      setTimeout(() => {
        router.push("/signup?step=plan&verified=true");
      }, 2000);
    } catch (err) {
      console.error("Verification error:", err);
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  // No token provided
  if (status === "no-token") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/20 to-background relative overflow-hidden">
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
                className="h-10 w-10 object-cover"
                priority
              />
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Aurswift
              </CardTitle>
            </div>
            <CardDescription className="text-base">
              Email Verification
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Invalid verification link. Please check your email and use the
                link provided, or request a new verification email.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-3">
              <Link href="/signup">
                <Button variant="outline" className="w-full">
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Go to Signup
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="ghost" className="w-full">
                  Back to Login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Verifying
  if (status === "verifying") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/20 to-background relative overflow-hidden">
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
                className="h-10 w-10 object-cover"
                priority
              />
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Aurswift
              </CardTitle>
            </div>
            <CardDescription className="text-base">
              Verifying your email...
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success
  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/20 to-background relative overflow-hidden">
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
                className="h-10 w-10 object-cover"
                priority
              />
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Aurswift
              </CardTitle>
            </div>
            <CardDescription className="text-base">
              Email Verified
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-sm text-green-800 dark:text-green-200">
                <strong>Email verified successfully!</strong>
                <br />
                Your email address has been verified. Redirecting to plan
                selection...
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already verified
  if (status === "already-verified") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/20 to-background relative overflow-hidden">
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
                className="h-10 w-10 object-cover"
                priority
              />
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Aurswift
              </CardTitle>
            </div>
            <CardDescription className="text-base">
              Email Already Verified
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Your email address has already been verified. You can now log in
                to your account.
              </AlertDescription>
            </Alert>

            <Link href="/login">
              <Button className="w-full">
                Go to Login
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/20 to-background relative overflow-hidden">
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
              className="h-10 w-10 object-cover"
              priority
            />
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              aurswift
            </CardTitle>
          </div>
          <CardDescription className="text-base">
            Verification Failed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error ||
                "This verification link is invalid or has expired. Please request a new verification email."}
            </AlertDescription>
          </Alert>

          <div className="flex flex-col gap-3">
            <Link href="/signup">
              <Button variant="outline" className="w-full">
                <Mail className="mr-2 h-4 w-4" />
                Request New Verification Email
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" className="w-full">
                Back to Login
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/20 to-background relative overflow-hidden">
          <Card className="w-full max-w-md relative z-10 shadow-xl border-border/50">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
