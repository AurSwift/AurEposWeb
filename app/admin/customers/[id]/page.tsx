import { db } from "@/lib/db";
import {
  customers,
  users,
  subscriptions,
  licenseKeys,
  supportTickets,
  invoices,
  terminalSessions,
} from "@/lib/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Building2,
  Calendar,
  CreditCard,
  Key,
  LifeBuoy,
  Activity,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { CustomerStatusManager } from "@/components/admin/customer-status-manager";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fetch customer with user information
  const [customer] = await db
    .select({
      id: customers.id,
      userId: customers.userId,
      email: customers.email,
      companyName: customers.companyName,
      billingAddress: customers.billingAddress,
      taxId: customers.taxId,
      stripeCustomerId: customers.stripeCustomerId,
      status: customers.status,
      createdAt: customers.createdAt,
      updatedAt: customers.updatedAt,
      userName: users.name,
      userEmail: users.email,
      userRole: users.role,
      emailVerified: users.emailVerified,
    })
    .from(customers)
    .leftJoin(users, eq(customers.userId, users.id))
    .where(eq(customers.id, id));

  if (!customer) {
    notFound();
  }

  // Fetch subscriptions
  const customerSubscriptions = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.customerId, id))
    .orderBy(desc(subscriptions.createdAt));

  // Fetch license keys
  const customerLicenses = await db
    .select()
    .from(licenseKeys)
    .where(eq(licenseKeys.customerId, id))
    .orderBy(desc(licenseKeys.createdAt));

  // Fetch support tickets
  const customerTickets = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.customerId, id))
    .orderBy(desc(supportTickets.createdAt))
    .limit(10);

  // Fetch invoices
  const customerInvoices = await db
    .select()
    .from(invoices)
    .where(eq(invoices.customerId, id))
    .orderBy(desc(invoices.createdAt))
    .limit(10);

  // Fetch terminal sessions (join through license keys)
  const customerTerminals = await db
    .select({
      id: terminalSessions.id,
      licenseKey: terminalSessions.licenseKey,
      machineIdHash: terminalSessions.machineIdHash,
      terminalName: terminalSessions.terminalName,
      hostname: terminalSessions.hostname,
      ipAddress: terminalSessions.ipAddress,
      appVersion: terminalSessions.appVersion,
      connectionStatus: terminalSessions.connectionStatus,
      firstConnectedAt: terminalSessions.firstConnectedAt,
      lastConnectedAt: terminalSessions.lastConnectedAt,
      lastHeartbeatAt: terminalSessions.lastHeartbeatAt,
      disconnectedAt: terminalSessions.disconnectedAt,
      isPrimary: terminalSessions.isPrimary,
    })
    .from(terminalSessions)
    .innerJoin(licenseKeys, eq(terminalSessions.licenseKey, licenseKeys.licenseKey))
    .where(eq(licenseKeys.customerId, id))
    .orderBy(desc(terminalSessions.lastConnectedAt))
    .limit(10);

  const statusColors: Record<string, string> = {
    active:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    suspended:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  const subscriptionStatusColors: Record<string, string> = {
    active:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    trialing:
      "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    past_due:
      "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    paused:
      "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };

  return (
    <div className="px-4 sm:px-0 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-foreground">
              {customer.companyName || customer.userName || "Customer Details"}
            </h1>
            <Badge
              variant="outline"
              className={statusColors[customer.status || ""] || ""}
            >
              {customer.status || "N/A"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Customer ID: {customer.id}
          </p>
        </div>
        <div className="flex gap-2">
          <CustomerStatusManager
            customerId={customer.id}
            currentStatus={customer.status || "active"}
          />
          <Button variant="outline" asChild>
            <Link href="/admin/customers">Back to Customers</Link>
          </Button>
        </div>
      </div>

      {/* Customer Information */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-muted-foreground">
                  Email
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground">{customer.email}</span>
                  {customer.emailVerified && (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                </div>
              </div>
            </div>

            {customer.companyName && (
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground">
                    Company Name
                  </div>
                  <div className="text-foreground">{customer.companyName}</div>
                </div>
              </div>
            )}

            {customer.taxId && (
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground">
                    Tax ID
                  </div>
                  <div className="text-foreground">{customer.taxId}</div>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-muted-foreground">
                  Created
                </div>
                <div className="text-foreground">
                  {customer.createdAt
                    ? new Date(customer.createdAt).toLocaleString()
                    : "N/A"}
                </div>
              </div>
            </div>

            {customer.stripeCustomerId && (
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground">
                    Stripe Customer ID
                  </div>
                  <div className="text-foreground font-mono text-sm">
                    {customer.stripeCustomerId}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-foreground">
                  {customerSubscriptions.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Subscriptions
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-foreground">
                  {
                    customerSubscriptions.filter(
                      (s) => s.status === "active" || s.status === "trialing"
                    ).length
                  }
                </div>
                <div className="text-sm text-muted-foreground">
                  Active Subscriptions
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-foreground">
                  {customerLicenses.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  License Keys
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-foreground">
                  {customerTickets.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Support Tickets
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-foreground">
                  {customerInvoices.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Recent Invoices
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-foreground">
                  {customerTerminals.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Active Terminals
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscriptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {customerSubscriptions.length > 0 ? (
            <div className="space-y-3">
              {customerSubscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {sub.planId || sub.planType || "Unknown Plan"}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          subscriptionStatusColors[sub.status || ""] || ""
                        }
                      >
                        {sub.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {sub.billingCycle} • ${sub.price}
                    </div>
                    {sub.currentPeriodEnd && (
                      <div className="text-xs text-muted-foreground">
                        Renews:{" "}
                        {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/subscriptions?id=${sub.id}`}>
                      View Details
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No subscriptions found
            </div>
          )}
        </CardContent>
      </Card>

      {/* License Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            License Keys
          </CardTitle>
        </CardHeader>
        <CardContent>
          {customerLicenses.length > 0 ? (
            <div className="space-y-3">
              {customerLicenses.map((license) => (
                <div
                  key={license.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">
                        {license.licenseKey}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          license.status === "active"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : license.status === "expired"
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                        }
                      >
                        {license.status}
                      </Badge>
                    </div>
                    {license.machineId && (
                      <div className="text-sm text-muted-foreground">
                        Machine: {license.machineId}
                      </div>
                    )}
                    {license.expiresAt && (
                      <div className="text-xs text-muted-foreground">
                        Expires: {new Date(license.expiresAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/licenses?id=${license.id}`}>
                      View
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No license keys found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Support Tickets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5" />
            Recent Support Tickets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {customerTickets.length > 0 ? (
            <div className="space-y-3">
              {customerTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-start justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{ticket.subject}</span>
                      <Badge
                        variant="outline"
                        className={
                          ticket.status === "open"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            : ticket.status === "in_progress"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                            : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        }
                      >
                        {ticket.status}
                      </Badge>
                      <Badge variant="outline">
                        {ticket.priority || "normal"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {ticket.description?.toString().substring(0, 100)}...
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created:{" "}
                      {ticket.createdAt
                        ? new Date(ticket.createdAt).toLocaleDateString()
                        : "N/A"}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/support?id=${ticket.id}`}>View</Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No support tickets found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Terminal Sessions */}
      {customerTerminals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Terminal Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {customerTerminals.map((terminal) => (
                <div
                  key={terminal.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="font-medium">
                      {terminal.terminalName || terminal.hostname || "Unknown Terminal"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      License: {terminal.licenseKey}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Machine: {terminal.machineIdHash?.substring(0, 20)}...
                    </div>
                    {terminal.lastHeartbeatAt && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Last heartbeat:{" "}
                        {new Date(terminal.lastHeartbeatAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      terminal.connectionStatus === "connected"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                    }
                  >
                    {terminal.connectionStatus}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices */}
      {customerInvoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Recent Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {customerInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="font-medium">
                      Invoice #{invoice.invoiceNumber || invoice.id.slice(0, 8)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ${invoice.amount} • {invoice.currency?.toUpperCase()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {invoice.createdAt
                        ? new Date(invoice.createdAt).toLocaleDateString()
                        : "N/A"}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      invoice.status === "paid"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : invoice.status === "open"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                    }
                  >
                    {invoice.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
