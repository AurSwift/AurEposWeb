"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, Calendar } from "lucide-react";
import { format } from "date-fns";

interface SubscriptionChange {
  id: string;
  changeType: string;
  previousPlanId: string | null;
  newPlanId: string | null;
  previousPrice: string | null;
  newPrice: string | null;
  prorationAmount: string | null;
  effectiveDate: Date | string;
  reason: string | null;
}

interface SubscriptionHistoryCardProps {
  changes: SubscriptionChange[];
}

export function SubscriptionHistoryCard({ changes }: SubscriptionHistoryCardProps) {
  if (!changes || changes.length === 0) {
    return null;
  }

  const getChangeTypeInfo = (changeType: string) => {
    switch (changeType.toLowerCase()) {
      case "plan_upgrade":
        return {
          icon: <ArrowUpRight className="w-4 h-4" />,
          color: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
          label: "Upgrade",
        };
      case "plan_downgrade":
        return {
          icon: <ArrowDownRight className="w-4 h-4" />,
          color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
          label: "Downgrade",
        };
      case "cancellation":
        return {
          icon: <ArrowDownRight className="w-4 h-4" />,
          color: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/30",
          label: "Cancelled",
        };
      default:
        return {
          icon: null,
          color: "bg-secondary text-secondary-foreground",
          label: changeType,
        };
    }
  };

  const formatProration = (amount: string | null) => {
    if (!amount) return null;
    const numAmount = parseFloat(amount);
    if (numAmount === 0) return null;
    
    if (numAmount > 0) {
      return `Charged $${Math.abs(numAmount).toFixed(2)}`;
    } else {
      return `Credit $${Math.abs(numAmount).toFixed(2)}`;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Subscription History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {changes.map((change) => {
            const typeInfo = getChangeTypeInfo(change.changeType);
            const prorationText = formatProration(change.prorationAmount);
            
            return (
              <div
                key={change.id}
                className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0"
              >
                <div className="flex-shrink-0 mt-1">
                  {typeInfo.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={typeInfo.color}>
                      {typeInfo.label}
                    </Badge>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(change.effectiveDate), "MMM dd, yyyy")}
                    </span>
                  </div>
                  
                  {change.previousPlanId && change.newPlanId && (
                    <p className="text-sm mt-1">
                      <span className="capitalize">{change.previousPlanId}</span>
                      {change.previousPrice && (
                        <span className="text-muted-foreground"> (${change.previousPrice})</span>
                      )}
                      <span className="text-muted-foreground"> → </span>
                      <span className="capitalize font-medium">{change.newPlanId}</span>
                      {change.newPrice && (
                        <span className="text-muted-foreground"> (${change.newPrice})</span>
                      )}
                    </p>
                  )}
                  
                  {prorationText && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {prorationText}
                    </p>
                  )}
                  
                  {change.reason && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {change.reason}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
