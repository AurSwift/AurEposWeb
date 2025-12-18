import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, CreditCard } from "lucide-react"

interface SubscriptionCardProps {
  subscription: {
    plan: string
    status: string
    nextBillingDate: string
  }
}

export function SubscriptionCard({ subscription }: SubscriptionCardProps) {
  const formattedDate = new Date(subscription.nextBillingDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-accent" />
          Subscription Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Current Plan</p>
          <p className="text-xl font-bold text-foreground">{subscription.plan}</p>
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-1">Status</p>
          <Badge className="bg-green-500/10 text-green-600 border-green-500/30">{subscription.status}</Badge>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Next Billing Date</p>
            <p className="text-sm font-medium">{formattedDate}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
