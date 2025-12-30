import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Export all schema tables for use in adapter
export * from "./schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  if (!_db) {
    // Disable prefetch as it is not supported for "Transaction" pool mode
    _client = postgres(process.env.DATABASE_URL, { prepare: false });
    _db = drizzle(_client, { schema });
  }

  return _db;
}

// Export the actual drizzle instance for use with adapters
export const db = getDb();

// Proxy for backward compatibility (if needed elsewhere)
export const dbProxy = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    return getDb()[prop as keyof ReturnType<typeof drizzle>];
  },
});
