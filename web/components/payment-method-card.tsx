"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PaymentMethod {
  type: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export function PaymentMethodCard() {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchPaymentMethod() {
      try {
        const response = await fetch("/api/stripe/payment-method");
        const data = await response.json();

        if (response.ok && data.paymentMethod) {
          setPaymentMethod(data.paymentMethod);
        }
      } catch (error) {
        console.error("Failed to fetch payment method:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchPaymentMethod();
  }, []);

  const handleUpdatePaymentMethod = async () => {
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to open billing portal",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Wallet className="w-5 h-5 text-accent" />
          Payment Method
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : paymentMethod ? (
          <>
            <div className="flex items-center gap-3">
              <div className="w-12 h-8 rounded bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-mono text-sm font-medium">
                  •••• •••• •••• {paymentMethod.last4}
                </p>
                <p className="text-xs text-muted-foreground">
                  Expires {paymentMethod.expMonth}/{paymentMethod.expYear}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full bg-transparent"
              onClick={handleUpdatePaymentMethod}
            >
              Update Payment Method
            </Button>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">
            No payment method on file
          </div>
        )}
      </CardContent>
    </Card>
  );
}
