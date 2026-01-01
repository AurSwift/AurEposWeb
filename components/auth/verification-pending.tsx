"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

interface VerificationPendingProps {
  email: string;
}

export function VerificationPending({ email }: VerificationPendingProps) {
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // Mask email for privacy (show first 3 chars and domain)
  const maskEmail = (email: string): string => {
    const [localPart, domain] = email.split("@");
    if (localPart.length <= 3) {
      return `${localPart[0]}***@${domain}`;
    }
    return `${localPart.substring(0, 3)}***@${domain}`;
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;

    setIsResending(true);
    setResendError("");
    setResendSuccess(false);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResendError(data.error || "Failed to resend verification email");
        setIsResending(false);
        return;
      }

      setResendSuccess(true);
      setIsResending(false);

      // Set cooldown timer (60 seconds)
      setCooldown(60);
      const interval = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Resend error:", err);
      setResendError("Something went wrong. Please try again.");
      setIsResending(false);
    }
  };

  return (
    <Card className="w-full max-w-lg shadow-xl border-border/50 backdrop-blur-sm">
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
          Verify Your Email Address
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
          <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Check your email!</strong>
            <br />
            We've sent a verification link to{" "}
            <strong>{maskEmail(email)}</strong>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Click the link in the email to verify your account and continue.
            </p>
            <p className="text-xs text-muted-foreground">
              Didn't receive the email? Check your spam folder or resend the
              verification email.
            </p>
          </div>

          {resendSuccess && (
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-sm text-green-800 dark:text-green-200">
                Verification email sent! Please check your inbox.
              </AlertDescription>
            </Alert>
          )}

          {resendError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {resendError}
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleResend}
            disabled={isResending || cooldown > 0}
            variant="outline"
            className="w-full"
          >
            {isResending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : cooldown > 0 ? (
              `Resend in ${cooldown}s`
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Resend Verification Email
              </>
            )}
          </Button>
        </div>

        <div className="text-center text-sm text-muted-foreground pt-4 border-t">
          <p>
            Need help?{" "}
            <Link
              href="/signup"
              className="text-primary hover:underline font-medium"
            >
              Sign up again
            </Link>{" "}
            or{" "}
            <Link
              href="/login"
              className="text-primary hover:underline font-medium"
            >
              go back to login
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
