import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  customers,
  subscriptions,
  supportTickets,
  licenseKeys,
  users,
  payments,
} from "@/lib/db/schema";
import { sql, desc, eq, gte } from "drizzle-orm";
import Link from "next/link";
import RefreshButton from "@/components/admin/refresh-button";

export default async function AdminDashboard() {
  const session = await auth();

  // Get statistics
  const [stats] = await db
    .select({
      totalCustomers: sql<number>`count(distinct ${customers.id})`,
      activeSubscriptions: sql<number>`count(distinct case when ${subscriptions.status} = 'active' then ${subscriptions.id} end)`,
      trialingSubscriptions: sql<number>`count(distinct case when ${subscriptions.status} = 'trialing' then ${subscriptions.id} end)`,
      openTickets: sql<number>`count(distinct case when ${supportTickets.status} = 'open' then ${supportTickets.id} end)`,
      activeLicenses: sql<number>`count(distinct case when ${licenseKeys.isActive} = true then ${licenseKeys.id} end)`,
    })
    .from(customers)
    .leftJoin(subscriptions, sql`${subscriptions.customerId} = ${customers.id}`)
    .leftJoin(
      supportTickets,
      sql`${supportTickets.customerId} = ${customers.id}`
    )
    .leftJoin(licenseKeys, sql`${licenseKeys.customerId} = ${customers.id}`);

  // Get recent customers (last 5) with subscription info
  const recentCustomers = await db
    .select({
      id: customers.id,
      email: customers.email,
      companyName: customers.companyName,
      accountStatus: customers.status,
      createdAt: customers.createdAt,
      userName: users.name,
      hasActiveSubscription: sql<boolean>`EXISTS(
        SELECT 1 FROM ${subscriptions} 
        WHERE ${subscriptions.customerId} = ${customers.id} 
        AND ${subscriptions.status} = 'active'
      )`,
      hasTrialingSubscription: sql<boolean>`EXISTS(
        SELECT 1 FROM ${subscriptions} 
        WHERE ${subscriptions.customerId} = ${customers.id} 
        AND ${subscriptions.status} = 'trialing'
      )`,
    })
    .from(customers)
    .leftJoin(users, eq(customers.userId, users.id))
    .orderBy(desc(customers.createdAt))
    .limit(5);

  // Get recent support tickets (last 5)
  const recentTickets = await db
    .select({
      id: supportTickets.id,
      subject: supportTickets.subject,
      category: supportTickets.category,
      priority: supportTickets.priority,
      status: supportTickets.status,
      createdAt: supportTickets.createdAt,
      customerEmail: customers.email,
    })
    .from(supportTickets)
    .leftJoin(customers, eq(supportTickets.customerId, customers.id))
    .orderBy(desc(supportTickets.createdAt))
    .limit(5);

  // Get recent subscriptions (last 5)
  const recentSubscriptions = await db
    .select({
      id: subscriptions.id,
      planId: subscriptions.planId,
      status: subscriptions.status,
      billingCycle: subscriptions.billingCycle,
      price: subscriptions.price,
      createdAt: subscriptions.createdAt,
      customerEmail: customers.email,
      companyName: customers.companyName,
    })
    .from(subscriptions)
    .leftJoin(customers, eq(subscriptions.customerId, customers.id))
    .orderBy(desc(subscriptions.createdAt))
    .limit(5);

  // Get revenue stats (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [revenueStatsResult] = await db
    .select({
      totalRevenue: sql<string>`COALESCE(SUM(CAST(${payments.amount} AS DECIMAL)), 0)`,
      paymentCount: sql<number>`COUNT(${payments.id})`,
    })
    .from(payments)
    .where(gte(payments.createdAt, thirtyDaysAgo));

  // Convert string to number (SQL returns decimals as strings)
  const revenueStats = {
    totalRevenue: revenueStatsResult
      ? parseFloat(revenueStatsResult.totalRevenue || "0")
      : 0,
    paymentCount: revenueStatsResult?.paymentCount || 0,
  };

  return (
    <div className="px-4 sm:px-0">
      <div className="flex items-center justify-between mb-8">
        <div className="text-sm text-gray-500">
          Welcome back,{" "}
          <span className="font-semibold">{session?.user.name}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="shrink-0">
                <svg
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Customers
                  </dt>
                  <dd className="text-3xl font-semibold text-gray-900">
                    {stats.totalCustomers}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="shrink-0">
                <svg
                  className="h-6 w-6 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Subscriptions
                  </dt>
                  <dd className="text-3xl font-semibold text-gray-900">
                    {stats.activeSubscriptions}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="shrink-0">
                <svg
                  className="h-6 w-6 text-yellow-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Open Tickets
                  </dt>
                  <dd className="text-3xl font-semibold text-gray-900">
                    {stats.openTickets}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="shrink-0">
                <svg
                  className="h-6 w-6 text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Licenses
                  </dt>
                  <dd className="text-3xl font-semibold text-gray-900">
                    {stats.activeLicenses}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue Card */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="shrink-0">
                <svg
                  className="h-6 w-6 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Revenue (30d)
                  </dt>
                  <dd className="text-3xl font-semibold text-gray-900">
                    ${revenueStats?.totalRevenue?.toFixed(2) || "0.00"}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trial Subscriptions and Revenue Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Trial Subscriptions Info */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-4">
            <svg
              className="h-6 w-6 text-purple-500 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900">
              Trial Subscriptions
            </h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Active Trials:</span>
              <span className="text-2xl font-bold text-purple-600">
                {stats.trialingSubscriptions}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Monitor trial conversions and reach out to users before trial ends
            </p>
          </div>
        </div>

        {/* Revenue Info */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-4">
            <svg
              className="h-6 w-6 text-green-500 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900">
              Revenue Overview
            </h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Last 30 Days:</span>
              <span className="text-2xl font-bold text-green-600">
                ${revenueStats?.totalRevenue?.toFixed(2) || "0.00"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Payments:</span>
              <span className="text-lg font-semibold text-gray-700">
                {revenueStats?.paymentCount || 0}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Track revenue trends and payment success rates
            </p>
          </div>
        </div>
      </div>

      {/* Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Recent Customers */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Customers
              </h2>
              <Link
                href="/admin/customers"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View all →
              </Link>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {recentCustomers.length > 0 ? (
              recentCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {customer.companyName || customer.userName || "No name"}
                      </p>
                      <p className="text-sm text-gray-500">{customer.email}</p>
                    </div>
                    <div className="ml-4 flex flex-col gap-1 items-end">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          customer.accountStatus === "active"
                            ? "bg-green-100 text-green-800"
                            : customer.accountStatus === "suspended"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {customer.accountStatus || "unknown"}
                      </span>
                      <div className="flex gap-1 items-center">
                        {customer.hasActiveSubscription ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Subscribed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            No subscription
                          </span>
                        )}
                        {customer.hasTrialingSubscription && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            Trialing
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {customer.createdAt
                      ? new Date(customer.createdAt).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }
                        )
                      : "Unknown date"}
                  </p>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-gray-500">
                No customers yet
              </div>
            )}
          </div>
        </div>

        {/* Recent Support Tickets */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Support Tickets
              </h2>
              <Link
                href="/admin/support"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View all →
              </Link>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {recentTickets.length > 0 ? (
              recentTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {ticket.subject}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {ticket.customerEmail || "Unknown customer"}
                      </p>
                    </div>
                    <div className="ml-4 flex flex-col items-end gap-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          ticket.priority === "urgent"
                            ? "bg-red-100 text-red-800"
                            : ticket.priority === "high"
                            ? "bg-orange-100 text-orange-800"
                            : ticket.priority === "medium"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {ticket.priority}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          ticket.status === "open"
                            ? "bg-blue-100 text-blue-800"
                            : ticket.status === "in_progress"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {ticket.createdAt
                      ? new Date(ticket.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Unknown date"}
                  </p>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-gray-500">
                No support tickets yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Subscriptions Table */}
      <div className="bg-white shadow rounded-lg mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Subscriptions
          </h2>
        </div>
        <div className="overflow-x-auto">
          {recentSubscriptions.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Billing
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentSubscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {sub.companyName || "No name"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {sub.customerEmail}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 capitalize">
                        {sub.planId || "Unknown"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 capitalize">
                        {sub.billingCycle || "N/A"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        ${sub.price || "0.00"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          sub.status === "active"
                            ? "bg-green-100 text-green-800"
                            : sub.status === "trialing"
                            ? "bg-blue-100 text-blue-800"
                            : sub.status === "past_due"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {sub.createdAt
                        ? new Date(sub.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Unknown"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-8 text-center text-gray-500">
              No subscriptions yet
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/admin/customers"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
          >
            <svg
              className="h-8 w-8 text-gray-400 mr-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Manage Customers
              </p>
              <p className="text-xs text-gray-500">View all customers</p>
            </div>
          </Link>
          <Link
            href="/admin/support"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
          >
            <svg
              className="h-8 w-8 text-gray-400 mr-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Support Tickets
              </p>
              <p className="text-xs text-gray-500">Handle support requests</p>
            </div>
          </Link>
          <Link
            href="/admin/licenses"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
          >
            <svg
              className="h-8 w-8 text-gray-400 mr-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900">License Keys</p>
              <p className="text-xs text-gray-500">Manage licenses</p>
            </div>
          </Link>
          <RefreshButton />
        </div>
      </div>
    </div>
  );
}
