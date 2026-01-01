"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Invoice {
  id: string;
  invoiceId: string;
  date: Date;
  amount: number;
  currency: string;
  status: string;
  plan: string;
  period: string | null;
  invoiceUrl: string | null;
  paidAt: Date | null;
}

export default function BillingHistoryPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchBillingHistory();
  }, []);

  const fetchBillingHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/billing-history");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch billing history");
      }

      setInvoices(data.billingHistory || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch billing history");
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to fetch billing history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = (invoice: Invoice) => {
    if (invoice.invoiceUrl) {
      // Open Stripe invoice URL if available
      window.open(invoice.invoiceUrl, "_blank");
    } else {
      // Generate fallback invoice text
      const invoiceContent = `
aurswift EPOS SOLUTIONS
Invoice: ${invoice.invoiceId}
Date: ${format(new Date(invoice.date), "MMM dd, yyyy")}

Description: ${invoice.plan}
${invoice.period ? `Billing Period: ${invoice.period}` : ""}

Amount: ${invoice.currency} ${invoice.amount.toFixed(2)}
Status: ${invoice.status}

Thank you for your business!
      `.trim();

      const blob = new Blob([invoiceContent], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.invoiceId}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-primary">Billing History</h1>
          <p className="text-muted-foreground mt-2">View and download your past invoices</p>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-muted-foreground">Loading billing history...</p>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-primary">Billing History</h1>
          <p className="text-muted-foreground mt-2">View and download your past invoices</p>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-destructive">{error}</p>
              <Button onClick={fetchBillingHistory} className="mt-4" variant="outline">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-primary">Billing History</h1>
        <p className="text-muted-foreground mt-2">View and download your past invoices</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>All your billing history in one place</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No billing history yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">{invoice.invoiceId}</h3>
                      <Badge variant={invoice.status === "Paid" ? "default" : "secondary"}>{invoice.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{invoice.plan}</p>
                    {invoice.period && (
                      <p className="text-xs text-muted-foreground mt-0.5">{invoice.period}</p>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">
                      Issued: {format(new Date(invoice.date), "MMMM dd, yyyy")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                  <div className="text-right">
                    <p className="text-xl font-bold text-primary">
                      {invoice.currency} {invoice.amount.toFixed(2)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadInvoice(invoice)}
                    className="whitespace-nowrap"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {invoice.invoiceUrl ? "View Invoice" : "Download"}
                  </Button>
                </div>
              </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
