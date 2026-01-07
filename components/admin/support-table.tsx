"use client";

import Link from "next/link";
import { DataTable, ColumnDef } from "@/components/admin/data-table";
import { Badge } from "@/components/ui/badge";

type SupportTicketRow = {
  ticketId: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  message: string;
  response: string | null;
  createdAt: Date | null;
  respondedAt: Date | null;
  customerEmail: string | null;
  companyName: string | null;
};

type SupportTableProps = {
  data: SupportTicketRow[];
};

export function SupportTable({ data }: SupportTableProps) {
  const columns: ColumnDef<SupportTicketRow>[] = [
    {
      header: "Subject",
      accessorKey: "subject",
      cell: (row) => (
        <div className="max-w-xs">
          <div className="font-medium text-foreground truncate">
            {row.subject}
          </div>
        </div>
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
      header: "Category",
      accessorKey: "category",
      cell: (row) => (
        <span className="text-muted-foreground capitalize">{row.category}</span>
      ),
      filterable: true,
      filterOptions: [
        { label: "Technical", value: "technical" },
        { label: "Billing", value: "billing" },
        { label: "License", value: "license" },
        { label: "Installation", value: "installation" },
        { label: "Feature", value: "feature" },
        { label: "Other", value: "other" },
      ],
    },
    {
      header: "Priority",
      accessorKey: "priority",
      cell: (row) => {
        const priorityColors: Record<string, string> = {
          urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
          high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
          medium:
            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
          low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        };
        return (
          <Badge
            variant="outline"
            className={priorityColors[row.priority] || ""}
          >
            {row.priority}
          </Badge>
        );
      },
      filterable: true,
      filterOptions: [
        { label: "Urgent", value: "urgent" },
        { label: "High", value: "high" },
        { label: "Medium", value: "medium" },
        { label: "Low", value: "low" },
      ],
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => {
        const statusColors: Record<string, string> = {
          open: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
          in_progress:
            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
          resolved:
            "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
          closed:
            "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
        };
        return (
          <Badge variant="outline" className={statusColors[row.status] || ""}>
            {row.status.replace("_", " ")}
          </Badge>
        );
      },
      filterable: true,
      filterOptions: [
        { label: "Open", value: "open" },
        { label: "In Progress", value: "in_progress" },
        { label: "Resolved", value: "resolved" },
        { label: "Closed", value: "closed" },
      ],
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
          href={`/admin/support/${row.ticketId}`}
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
      searchPlaceholder="Search by subject or customer..."
      searchKeys={["subject", "customerEmail", "companyName", "message"]}
      pageSize={10}
      emptyMessage="No support tickets found"
    />
  );
}




