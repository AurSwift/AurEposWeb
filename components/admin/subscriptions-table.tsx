"use client";

import { DataTable, ColumnDef } from "@/components/admin/data-table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

type SubscriptionRow = {
  subscriptionId: string;
  customerId: string;
  planId: string | null;
  planType: string | null;
  billingCycle: string | null;
  price: string | null;
  status: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  nextBillingDate: Date | null;
  cancelAtPeriodEnd: boolean | null;
  trialStart: Date | null;
  trialEnd: Date | null;
  quantity: number | null;
  stripeSubscriptionId: string | null;
  createdAt: Date | null;
  customerEmail: string | null;
  companyName: string | null;
};

type SubscriptionsTableProps = {
  data: SubscriptionRow[];
};

export function SubscriptionsTable({ data }: SubscriptionsTableProps) {
  const columns: ColumnDef<SubscriptionRow>[] = [
    {
      header: "Customer",
      cell: (row) => (
        <div>
          <div className="font-medium text-foreground">
            {row.companyName || "N/A"}
          </div>
          <div className="text-xs text-muted-foreground">
            {row.customerEmail}
          </div>
        </div>
      ),
    },
    {
      header: "Plan",
      accessorKey: "planId",
      cell: (row) => (
        <div>
          <div className="font-medium text-foreground">
            {row.planId || row.planType || "N/A"}
          </div>
          {row.billingCycle && (
            <div className="text-xs text-muted-foreground capitalize">
              {row.billingCycle}
            </div>
          )}
        </div>
      ),
      filterable: true,
      filterOptions: [
        { label: "Monthly", value: "monthly" },
        { label: "Annual", value: "annual" },
      ],
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => {
        const statusColors: Record<string, string> = {
          active:
            "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
          trialing:
            "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
          past_due:
            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
          cancelled:
            "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
          paused:
            "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
        };
        return (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={statusColors[row.status || ""] || ""}
            >
              {row.status || "N/A"}
            </Badge>
            {row.cancelAtPeriodEnd && (
              <Badge
                variant="outline"
                className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs"
              >
                Canceling
              </Badge>
            )}
          </div>
        );
      },
      filterable: true,
      filterOptions: [
        { label: "Active", value: "active" },
        { label: "Trialing", value: "trialing" },
        { label: "Past Due", value: "past_due" },
        { label: "Cancelled", value: "cancelled" },
        { label: "Paused", value: "paused" },
      ],
    },
    {
      header: "Price",
      accessorKey: "price",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.price ? `$${parseFloat(row.price).toFixed(2)}` : "N/A"}
        </span>
      ),
    },
    {
      header: "Period",
      cell: (row) => {
        if (row.trialStart && row.trialEnd) {
          const trialEnd = new Date(row.trialEnd);
          if (trialEnd > new Date()) {
            return (
              <div className="text-xs">
                <div className="text-muted-foreground">Trial ends</div>
                <div className="font-medium">
                  {trialEnd.toLocaleDateString()}
                </div>
              </div>
            );
          }
        }
        if (row.currentPeriodEnd) {
          return (
            <div className="text-xs">
              <div className="text-muted-foreground">Renews</div>
              <div className="font-medium">
                {new Date(row.currentPeriodEnd).toLocaleDateString()}
              </div>
            </div>
          );
        }
        return <span className="text-muted-foreground">N/A</span>;
      },
    },
    {
      header: "Created",
      accessorKey: "createdAt",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "N/A"}
        </span>
      ),
    },
    {
      header: "Actions",
      cell: (row) => (
        <Link
          href={`/admin/customers/${row.customerId}`}
          className="text-primary hover:text-primary/80 font-medium"
        >
          View Customer
        </Link>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search by customer or plan..."
      searchKeys={["customerEmail", "companyName", "planId", "planType"]}
      pageSize={10}
      emptyMessage="No subscriptions found"
    />
  );
}




