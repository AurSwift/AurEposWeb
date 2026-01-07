"use client";

import { DataTable, ColumnDef } from "@/components/admin/data-table";
import { Badge } from "@/components/ui/badge";

type LicenseRow = {
  licenseId: string;
  licenseKey: string;
  maxTerminals: number | null;
  activationCount: number | null;
  isActive: boolean | null;
  issuedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  customerEmail: string | null;
  companyName: string | null;
  subscriptionStatus: string | null;
};

type LicensesTableProps = {
  data: LicenseRow[];
};

export function LicensesTable({ data }: LicensesTableProps) {
  const columns: ColumnDef<LicenseRow>[] = [
    {
      header: "License Key",
      accessorKey: "licenseKey",
      cell: (row) => (
        <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
          {row.licenseKey}
        </code>
      ),
    },
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
      header: "Status",
      cell: (row) => {
        if (row.revokedAt) {
          return (
            <Badge
              variant="outline"
              className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
            >
              Revoked
            </Badge>
          );
        }
        if (row.isActive) {
          return (
            <Badge
              variant="outline"
              className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
            >
              Active
            </Badge>
          );
        }
        return (
          <Badge
            variant="outline"
            className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
          >
            Inactive
          </Badge>
        );
      },
      filterable: true,
      filterOptions: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
        { label: "Revoked", value: "revoked" },
      ],
    },
    {
      header: "Activations",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.activationCount || 0} / {row.maxTerminals || 1}
        </span>
      ),
    },
    {
      header: "Subscription",
      accessorKey: "subscriptionStatus",
      cell: (row) => {
        if (!row.subscriptionStatus) {
          return <span className="text-muted-foreground">N/A</span>;
        }
        const statusColors: Record<string, string> = {
          active:
            "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
          trialing:
            "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
          past_due:
            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
          cancelled:
            "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
        };
        return (
          <Badge
            variant="outline"
            className={statusColors[row.subscriptionStatus] || ""}
          >
            {row.subscriptionStatus}
          </Badge>
        );
      },
      filterable: true,
      filterOptions: [
        { label: "Active", value: "active" },
        { label: "Trialing", value: "trialing" },
        { label: "Past Due", value: "past_due" },
        { label: "Cancelled", value: "cancelled" },
      ],
    },
    {
      header: "Issued",
      accessorKey: "issuedAt",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.issuedAt ? new Date(row.issuedAt).toLocaleDateString() : "N/A"}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search by license key or customer..."
      searchKeys={["licenseKey", "customerEmail", "companyName"]}
      pageSize={10}
      emptyMessage="No license keys found"
    />
  );
}

