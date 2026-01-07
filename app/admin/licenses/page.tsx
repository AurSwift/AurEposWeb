import { db } from "@/lib/db";
import { licenseKeys, customers, subscriptions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { LicensesTable } from "@/components/admin/licenses-table";

export default async function AdminLicensesPage() {
  // Get all license keys with customer info
  const licenses = await db
    .select({
      licenseId: licenseKeys.id,
      licenseKey: licenseKeys.licenseKey,
      maxTerminals: licenseKeys.maxTerminals,
      activationCount: licenseKeys.activationCount,
      isActive: licenseKeys.isActive,
      issuedAt: licenseKeys.issuedAt,
      expiresAt: licenseKeys.expiresAt,
      revokedAt: licenseKeys.revokedAt,
      customerEmail: customers.email,
      companyName: customers.companyName,
      subscriptionStatus: subscriptions.status,
    })
    .from(licenseKeys)
    .leftJoin(customers, eq(licenseKeys.customerId, customers.id))
    .leftJoin(subscriptions, eq(licenseKeys.subscriptionId, subscriptions.id))
    .orderBy(desc(licenseKeys.issuedAt));

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">License Keys</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage all license keys issued to customers with activation tracking.
        </p>
      </div>

      <LicensesTable data={licenses} />
    </div>
  );
}
