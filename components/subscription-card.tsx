import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, CreditCard, AlertCircle, CheckCircle2, Crown, Zap, Shield } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

interface SubscriptionCardProps {
  subscription: {
    planId?: string
    plan: string
    status: string
    nextBillingDate: string | Date | null
    cancelAtPeriodEnd?: boolean
    trialEnd?: string | Date | null
    price?: string
    billingCycle?: string
  }
}

export function SubscriptionCard({ subscription }: SubscriptionCardProps) {
  const hasActiveSubscription = subscription.status.toLowerCase() === "active" || 
    subscription.status.toLowerCase() === "trialing";
  const nextBillingDate = subscription.nextBillingDate ? new Date(subscription.nextBillingDate) : null;
  const formattedDate = nextBillingDate ? format(nextBillingDate, "MMM dd, yyyy") : null;
  
  const getPlanIcon = (planName: string) => {
    const normalized = planName.toLowerCase();
    if (normalized.includes("enterprise")) return <Shield className="w-5 h-5 text-primary" />;
    if (normalized.includes("professional")) return <Crown className="w-5 h-5 text-primary" />;
    return <Zap className="w-5 h-5 text-primary" />;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30';
      case 'trialing': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'past_due': return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30';
      case 'cancelled':
      case 'canceled': return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/30';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-muted-foreground" />
            <span>Subscription</span>
          </div>
          <Badge variant="outline" className={getStatusColor(subscription.status)}>
            {subscription.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 flex-1">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Current Plan</p>
            <div className="flex items-center gap-2">
              {getPlanIcon(subscription.plan)}
              <span className="text-xl font-bold">{subscription.plan}</span>
            </div>
            {subscription.price && (
              <p className="text-sm text-muted-foreground mt-1">
                ${subscription.price}/{subscription.billingCycle === 'annual' ? 'yr' : 'mo'}
              </p>
            )}
          </div>
        </div>

        {subscription.cancelAtPeriodEnd && (
           <div className="flex items-start gap-2 p-2 bg-destructive/10 text-destructive rounded text-xs">
             <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
             <p>Cancels on {formattedDate}</p>
           </div>
        )}

        {subscription.trialEnd && new Date(subscription.trialEnd) > new Date() && (
           <div className="flex items-start gap-2 p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-xs">
             <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
             <p>Trial ends {format(new Date(subscription.trialEnd), "MMM dd")}</p>
           </div>
        )}

        {hasActiveSubscription && formattedDate && (
          <div className="flex items-center gap-2 pt-2 border-t border-border mt-auto">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">
                {subscription.cancelAtPeriodEnd ? "Access until" : "Next billing"}
              </p>
              <p className="text-sm font-medium">{formattedDate}</p>
            </div>
          </div>
        )}
      </CardContent>
      {hasActiveSubscription && (
        <CardFooter>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/dashboard/subscription">Manage Subscription</Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
