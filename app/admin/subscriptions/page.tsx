import { db } from "@/lib/db";
import { subscriptions, customers } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { SubscriptionsTable } from "@/components/admin/subscriptions-table";

export default async function AdminSubscriptionsPage() {
  // Get all subscriptions with customer info
  const allSubscriptions = await db
    .select({
      subscriptionId: subscriptions.id,
      customerId: subscriptions.customerId,
      planId: subscriptions.planId,
      planType: subscriptions.planType,
      billingCycle: subscriptions.billingCycle,
      price: subscriptions.price,
      status: subscriptions.status,
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      nextBillingDate: subscriptions.nextBillingDate,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      trialStart: subscriptions.trialStart,
      trialEnd: subscriptions.trialEnd,
      quantity: subscriptions.quantity,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      createdAt: subscriptions.createdAt,
      customerEmail: customers.email,
      companyName: customers.companyName,
    })
    .from(subscriptions)
    .leftJoin(customers, eq(subscriptions.customerId, customers.id))
    .orderBy(desc(subscriptions.createdAt));

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Subscriptions</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage all customer subscriptions, billing cycles, and payment status.
        </p>
      </div>

      <SubscriptionsTable data={allSubscriptions} />
    </div>
  );
}
