"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { PlanId, BillingCycle } from "@/lib/stripe/plans";

interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
}

interface SubscriptionActionsProps {
  onUpdate?: () => void;
}

type CancelType = "end_of_period" | "immediately";

export function SubscriptionActions({ onUpdate }: SubscriptionActionsProps) {
  const router = useRouter();
  const [subscription, setSubscription] = useState<any>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [cancelType, setCancelType] = useState<CancelType>("end_of_period");
  const [cancelReason, setCancelReason] = useState("");
  const [newPlanId, setNewPlanId] = useState<PlanId>("basic");
  const [newBillingCycle, setNewBillingCycle] =
    useState<BillingCycle>("monthly");
  const [loading, setLoading] = useState(false);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const { toast } = useToast();

  // Fetch current subscription
  useEffect(() => {
    async function fetchSubscription() {
      try {
        const response = await fetch("/api/subscriptions/current");
        const data = await response.json();
        if (data.subscription) {
          setSubscription(data.subscription);
          setNewPlanId(data.subscription.planId);
          setNewBillingCycle(data.subscription.billingCycle);
        }
      } catch (error) {
        console.error("Failed to fetch subscription:", error);
      } finally {
        setSubscriptionLoading(false);
      }
    }
    fetchSubscription();
  }, []);

  // Fetch plans from API
  useEffect(() => {
    async function fetchPlans() {
      try {
        const response = await fetch("/api/plans");
        const data = await response.json();
        if (data.plans) {
          // Convert plans object to array
          const plansArray = Object.values(data.plans) as Plan[];
          // Sort: basic, professional, enterprise
          const planOrder: PlanId[] = ["basic", "professional", "enterprise"];
          plansArray.sort((a, b) => {
            return planOrder.indexOf(a.id) - planOrder.indexOf(b.id);
          });
          setPlans(plansArray);
        }
      } catch (error) {
        console.error("Failed to fetch plans:", error);
        toast({
          title: "Error",
          description: "Failed to load plans. Please refresh the page.",
          variant: "destructive",
        });
      } finally {
        setPlansLoading(false);
      }
    }
    fetchPlans();
  }, [toast]);

  const handleCancel = async () => {
    if (!subscription) return;
    setLoading(true);
    try {
      const response = await fetch("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: subscription.id,
          cancelImmediately: cancelType === "immediately",
          reason: cancelReason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel subscription");
      }

      toast({
        title: "Success",
        description: data.message,
      });

      onUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to cancel subscription",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!subscription) return;
    setLoading(true);
    try {
      const response = await fetch("/api/subscriptions/reactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: subscription.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reactivate subscription");
      }

      toast({
        title: "Success",
        description: data.message,
      });

      // Refresh the page data
      router.refresh();
      onUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to reactivate subscription",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePlan = async () => {
    if (!subscription) return;
    setLoading(true);
    try {
      const response = await fetch("/api/subscriptions/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: subscription.id,
          newPlanId,
          newBillingCycle,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to change plan");
      }

      toast({
        title: "Success",
        description: data.message,
      });

      setChangePlanOpen(false);

      // Refresh the page data
      router.refresh();
      onUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to change plan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPrice = (planId: string, billingCycle: string) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return 0;
    return billingCycle === "monthly" ? plan.priceMonthly : plan.priceAnnual;
  };

  const getCurrentPrice = () => {
    if (!subscription) return 0;
    return getPrice(subscription.planId, subscription.billingCycle);
  };

  const getNewPrice = () => {
    return getPrice(newPlanId, newBillingCycle);
  };

  const isUpgrade = subscription ? getNewPrice() > getCurrentPrice() : false;

  return (
    <div className="flex flex-wrap gap-2">
      {/* Change Plan Button */}
      <Dialog open={changePlanOpen} onOpenChange={setChangePlanOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">Change Plan</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Subscription Plan</DialogTitle>
            <DialogDescription>
              Upgrade or downgrade your subscription. Changes take effect
              immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Plan</Label>
              {plansLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Loading plans...
                  </span>
                </div>
              ) : (
                <Select
                  value={newPlanId}
                  onValueChange={(value) => setNewPlanId(value as PlanId)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - ${getPrice(plan.id, newBillingCycle)}/
                        {newBillingCycle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Billing Cycle</Label>
              <RadioGroup
                value={newBillingCycle}
                onValueChange={(value) =>
                  setNewBillingCycle(value as BillingCycle)
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="monthly" id="monthly" />
                  <Label htmlFor="monthly">Monthly</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="annual" id="annual" />
                  <Label htmlFor="annual">Annual (Save 20%)</Label>
                </div>
              </RadioGroup>
            </div>
            {subscription &&
              (newPlanId !== subscription.planId ||
                newBillingCycle !== subscription.billingCycle) &&
              !plansLoading && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium">
                    New Price: ${getNewPrice()}/{newBillingCycle}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isUpgrade
                      ? "You'll be charged a prorated amount for the upgrade."
                      : "Credit will be applied to your next invoice."}
                  </p>
                </div>
              )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setChangePlanOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangePlan}
              disabled={
                loading ||
                !subscription ||
                (newPlanId === subscription.planId &&
                  newBillingCycle === subscription.billingCycle)
              }
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel or Reactivate Button */}
      {subscription?.cancelAtPeriodEnd ? (
        <Button onClick={handleReactivate} disabled={loading} variant="default">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Reactivate Subscription
        </Button>
      ) : (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Cancel Subscription</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
              <AlertDialogDescription>
                This will cancel your subscription. You can choose when the
                cancellation takes effect.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <RadioGroup
                value={cancelType}
                onValueChange={(value) => setCancelType(value as CancelType)}
              >
                <Label
                  htmlFor="end_of_period"
                  className={`flex items-start space-x-2 p-3 border rounded-md cursor-pointer transition-colors hover:bg-accent/20 ${
                    cancelType === "end_of_period"
                      ? "border-primary/30 bg-primary/5"
                      : ""
                  }`}
                >
                  <RadioGroupItem
                    value="end_of_period"
                    id="end_of_period"
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium">
                      Cancel at end of billing period
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      You'll retain access until your current period ends
                    </p>
                  </div>
                </Label>
                <Label
                  htmlFor="immediately"
                  className={`flex items-start space-x-2 p-3 border rounded-md cursor-pointer transition-colors hover:bg-destructive/5 ${
                    cancelType === "immediately"
                      ? "border-destructive/30 bg-destructive/5"
                      : ""
                  }`}
                >
                  <RadioGroupItem
                    value="immediately"
                    id="immediately"
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Cancel immediately</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Access ends now. No refund for remaining time.
                    </p>
                  </div>
                </Label>
              </RadioGroup>
              <div className="space-y-2">
                <Label htmlFor="reason">
                  Reason for cancellation (optional)
                </Label>
                <Textarea
                  id="reason"
                  placeholder="Help us improve by telling us why you're canceling..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">
                    You will lose access to:
                  </p>
                  <ul className="list-disc list-inside text-destructive/80 mt-1 space-y-1">
                    <li>License keys</li>
                    <li>Software updates</li>
                    <li>Customer support</li>
                  </ul>
                </div>
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>
                Keep Subscription
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancel}
                disabled={loading}
                className="bg-destructive hover:bg-destructive/90"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Cancellation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
