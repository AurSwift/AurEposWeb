"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface Payment {
  id: string;
  amount: string;
  currency: string;
  status: string;
  paymentType: string;
  invoiceUrl: string | null;
  billingPeriodStart: Date | null;
  billingPeriodEnd: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  subscription: {
    planId: string | null;
    billingCycle: string | null;
  } | null;
}

interface PaginationInfo {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function PaymentHistory() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = async (page: number = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/payments/history?page=${page}&limit=10`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch payments");
      }

      setPayments(data.payments || []);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "failed":
        return "destructive";
      case "pending":
        return "secondary";
      case "refunded":
        return "outline";
      default:
        return "secondary";
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchPayments(newPage);
  };

  if (loading && payments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading payment history...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-destructive">{error}</p>
            <Button onClick={() => fetchPayments()} className="mt-4" variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No payments yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Payment List */}
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 hover:bg-muted/50 p-3 rounded-md transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium">
                          ${parseFloat(payment.amount).toFixed(2)} {payment.currency}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {payment.paidAt
                            ? format(new Date(payment.paidAt), "MMM dd, yyyy")
                            : format(new Date(payment.createdAt), "MMM dd, yyyy")}
                        </p>
                      </div>
                    </div>
                    {payment.subscription && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {payment.subscription.planId} - {payment.subscription.billingCycle}
                      </p>
                    )}
                    {payment.billingPeriodStart && payment.billingPeriodEnd && (
                      <p className="text-xs text-muted-foreground">
                        Period: {format(new Date(payment.billingPeriodStart), "MMM dd")} -{" "}
                        {format(new Date(payment.billingPeriodEnd), "MMM dd, yyyy")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={getStatusBadgeVariant(payment.status)}>
                      {payment.status}
                    </Badge>
                    {payment.invoiceUrl && (
                      <Button
                        size="sm"
                        variant="ghost"
                        asChild
                      >
                        <a
                          href={payment.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1"
                        >
                          <Download className="h-4 w-4" />
                          <span className="sr-only">Download Invoice</span>
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
                  {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
                  {pagination.total} payments
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages || loading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
