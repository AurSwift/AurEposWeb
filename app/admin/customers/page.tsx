import { db } from "@/lib/db";
import { customers, users, subscriptions } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { CustomersTable } from "@/components/admin/customers-table";

export default async function AdminCustomersPage() {
  // Get all customers with their user info and subscription counts
  const allCustomers = await db
    .select({
      customerId: customers.id,
      customerEmail: customers.email,
      companyName: customers.companyName,
      status: customers.status,
      createdAt: customers.createdAt,
      stripeCustomerId: customers.stripeCustomerId,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      emailVerified: users.emailVerified,
      activeSubscriptions:
        sql<number>`COUNT(CASE WHEN ${subscriptions.status} = 'active' THEN 1 END)`.as(
          "active_subscriptions"
        ),
    })
    .from(customers)
    .leftJoin(users, eq(customers.userId, users.id))
    .leftJoin(subscriptions, eq(subscriptions.customerId, customers.id))
    .groupBy(
      customers.id,
      customers.email,
      customers.companyName,
      customers.status,
      customers.createdAt,
      customers.stripeCustomerId,
      users.id,
      users.name,
      users.email,
      users.emailVerified
    )
    .orderBy(desc(customers.createdAt));

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Customers</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage all customers including their subscriptions and account status.
        </p>
      </div>

      <CustomersTable data={allCustomers} />
    </div>
  );
}
