import { db } from "../../lib/db";
import { subscriptions, customers, users } from "../../lib/db/schema";
import { eq } from "drizzle-orm";

const [customer] = await db
  .select()
  .from(customers)
  .innerJoin(users, eq(customers.userId, users.id))
  .where(eq(users.email, "demo@company.com"))
  .limit(1);

if (customer) {
  const subs = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.customerId, customer.customers.id));
  
  console.log(JSON.stringify(subs, null, 2));
}
