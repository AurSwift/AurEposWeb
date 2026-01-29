"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface Invoice {
  id: string;
  stripeInvoiceId: string;
  number: string | null;
  status: string;
  total: number;
  amountPaid: number;
  currency: string;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  description: string | null;
  createdAt: string;
  paidAt: string | null;
}

export function InvoiceHistory() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        // First, sync from Stripe to ensure we have latest data
        await fetch("/api/stripe/sync", { method: "POST" }).catch((err) => {
          console.warn("Sync failed, continuing with local data:", err);
        });

        // Then fetch from database
        const response = await fetch("/api/invoices/history");
        const data = await response.json();
        if (response.ok) {
          setInvoices(data.invoices || []);
        }
      } catch (error) {
        console.error("Failed to fetch invoices:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchInvoices();
  }, []);

  if (loading) {
    return <div className="text-center py-8">Loading invoices...</div>;
  }

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No invoices found
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice History</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell>
                  {format(new Date(invoice.createdAt), "MMM dd, yyyy")}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {invoice.number || invoice.stripeInvoiceId.slice(0, 12)}
                </TableCell>
                <TableCell>
                  {invoice.description || "Subscription payment"}
                </TableCell>
                <TableCell>
                  ${(invoice.total / 100).toFixed(2)}{" "}
                  {invoice.currency.toUpperCase()}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      invoice.status === "paid"
                        ? "default"
                        : invoice.status === "open"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {invoice.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {invoice.hostedInvoiceUrl && (
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={invoice.hostedInvoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                    {invoice.invoicePdf && (
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={invoice.invoicePdf}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

