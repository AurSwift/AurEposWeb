import { db } from "@/lib/db";
import { supportTickets, customers } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { SupportTable } from "@/components/admin/support-table";

export default async function AdminSupportPage() {
  // Get all support tickets with customer info
  const tickets = await db
    .select({
      ticketId: supportTickets.id,
      subject: supportTickets.subject,
      category: supportTickets.category,
      priority: supportTickets.priority,
      status: supportTickets.status,
      message: supportTickets.message,
      response: supportTickets.response,
      createdAt: supportTickets.createdAt,
      respondedAt: supportTickets.respondedAt,
      customerEmail: customers.email,
      companyName: customers.companyName,
    })
    .from(supportTickets)
    .leftJoin(customers, eq(supportTickets.customerId, customers.id))
    .orderBy(desc(supportTickets.createdAt));

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Support Tickets</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage customer support requests and inquiries with priority tracking.
        </p>
      </div>

      <SupportTable data={tickets} />
    </div>
  );
}
