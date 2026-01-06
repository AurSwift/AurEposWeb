"use client";

import { useEffect } from "react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Pricing page error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/20 to-background">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 mx-auto mb-4 text-destructive" />
            <h2 className="text-2xl font-bold mb-2">Something went wrong!</h2>
            <p className="text-muted-foreground mb-6">
              {error.message || "An unexpected error occurred while loading the pricing page."}
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={reset} size="lg">
                Try again
              </Button>
              <Button
                variant="outline"
                onClick={() => (window.location.href = "/")}
                size="lg"
              >
                Go home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}

