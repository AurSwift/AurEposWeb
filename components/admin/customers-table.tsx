"use client";

import Link from "next/link";
import { DataTable, ColumnDef } from "@/components/admin/data-table";
import { Badge } from "@/components/ui/badge";

type CustomerRow = {
  customerId: string;
  customerEmail: string;
  companyName: string | null;
  status: string | null;
  createdAt: Date | null;
  stripeCustomerId: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  emailVerified: Date | null;
  activeSubscriptions: number;
};

type CustomersTableProps = {
  data: CustomerRow[];
};

export function CustomersTable({ data }: CustomersTableProps) {
  const columns: ColumnDef<CustomerRow>[] = [
    {
      header: "Company / Name",
      cell: (row) => (
        <div>
          <div className="font-medium text-foreground">
            {row.companyName || row.userName || "N/A"}
          </div>
          {row.emailVerified ? (
            <div className="text-xs text-green-600">✓ Verified</div>
          ) : (
            <div className="text-xs text-muted-foreground">Not verified</div>
          )}
        </div>
      ),
    },
    {
      header: "Email",
      accessorKey: "customerEmail",
      cell: (row) => (
        <span className="text-muted-foreground">{row.customerEmail}</span>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      filterable: true,
      filterOptions: [
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Cancelled", value: "cancelled" },
      ],
      cell: (row) => {
        const statusColors: Record<string, string> = {
          active:
            "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
          suspended:
            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
          cancelled:
            "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
        };
        return (
          <Badge
            variant="outline"
            className={statusColors[row.status || ""] || ""}
          >
            {row.status || "N/A"}
          </Badge>
        );
      },
    },
    {
      header: "Subscriptions",
      accessorKey: "activeSubscriptions",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.activeSubscriptions} active
        </span>
      ),
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
          View
        </Link>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search by email or company..."
      searchKeys={["customerEmail", "companyName", "userName"]}
      pageSize={10}
      emptyMessage="No customers found"
    />
  );
}

