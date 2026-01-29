import { db } from "@/lib/db";
import { customers, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Customer } from "@/lib/db/schema";
import type { Session } from "next-auth";

/**
 * Custom error for customer not found scenarios
 * Provides consistent error handling across the application
 */
export class CustomerNotFoundError extends Error {
  public readonly statusCode = 404;

  constructor(message: string = "Customer not found") {
    super(message);
    this.name = "CustomerNotFoundError";
  }
}

/**
 * Custom error for deleted customer scenarios
 * Provides consistent error handling for soft-deleted customers
 */
export class CustomerDeletedError extends Error {
  public readonly statusCode = 403;

  constructor(message: string = "Customer account has been deleted") {
    super(message);
    this.name = "CustomerDeletedError";
  }
}

/**
 * Get customer by user ID
 *
 * @param userId - The user ID to look up
 * @returns Customer object or null if not found
 *
 * @example
 * const customer = await getCustomerByUserId(session.user.id);
 * if (!customer) {
 *   // Handle not found case
 * }
 */
export async function getCustomerByUserId(
  userId: string
): Promise<Customer | null> {
  try {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, userId))
      .limit(1);

    return customer || null;
  } catch (error) {
    console.error("Error fetching customer by user ID:", { userId, error });
    throw error;
  }
}

/**
 * Get customer by user ID or throw error if not found or deleted
 * Use this when customer must exist and be active (will throw CustomerNotFoundError or CustomerDeletedError)
 *
 * @param userId - The user ID to look up
 * @param allowDeleted - If true, allows returning deleted customers (default: false)
 * @returns Customer object
 * @throws {CustomerNotFoundError} If customer is not found
 * @throws {CustomerDeletedError} If customer is soft-deleted and allowDeleted is false
 *
 * @example
 * try {
 *   const customer = await getCustomerOrThrow(session.user.id);
 *   // Customer exists and is active, proceed with business logic
 * } catch (error) {
 *   if (error instanceof CustomerNotFoundError) {
 *     return NextResponse.json({ error: error.message }, { status: 404 });
 *   }
 *   if (error instanceof CustomerDeletedError) {
 *     return NextResponse.json({ error: error.message }, { status: 403 });
 *   }
 *   throw error;
 * }
 */
export async function getCustomerOrThrow(
  userId: string,
  allowDeleted: boolean = false
): Promise<Customer> {
  const customer = await getCustomerByUserId(userId);

  if (!customer) {
    throw new CustomerNotFoundError(
      "Customer record not found. Please contact support if this persists."
    );
  }

  // Check if customer has been soft-deleted
  if (!allowDeleted && customer.status === "deleted") {
    throw new CustomerDeletedError(
      "Your customer account has been deleted. Please contact support or create a new account."
    );
  }

  return customer;
}

/**
 * Get customer by customer ID
 *
 * @param customerId - The customer ID to look up
 * @returns Customer object or null if not found
 */
export async function getCustomerById(
  customerId: string
): Promise<Customer | null> {
  try {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    return customer || null;
  } catch (error) {
    console.error("Error fetching customer by ID:", { customerId, error });
    throw error;
  }
}

/**
 * Check if a customer exists for a given user ID
 * Useful for validation without fetching full customer object
 *
 * @param userId - The user ID to check
 * @returns True if customer exists, false otherwise
 */
export async function customerExists(userId: string): Promise<boolean> {
  const customer = await getCustomerByUserId(userId);
  return customer !== null;
}

/**
 * Get customer from session
 * Only works for customer role users
 * Internal users (admin, support, developer) don't have customer records
 *
 * @param session - User session
 * @returns Customer object or null
 * @throws Error if session is invalid
 */
export async function getCustomerFromSession(
  session: Session
): Promise<Customer | null> {
  if (!session?.user?.id) {
    throw new Error("Invalid session");
  }

  // Internal users don't have customer records
  if (
    session.user.role === "admin" ||
    session.user.role === "support" ||
    session.user.role === "developer"
  ) {
    return null;
  }

  return getCustomerByUserId(session.user.id);
}

/**
 * Require customer from session or throw error
 * Use this in customer-only endpoints
 *
 * @param session - User session
 * @returns Customer object
 * @throws CustomerNotFoundError if customer doesn't exist
 */
export async function requireCustomerFromSession(
  session: Session
): Promise<Customer> {
  const customer = await getCustomerFromSession(session);

  if (!customer) {
    throw new CustomerNotFoundError(
      "Customer record not found. This endpoint is only available to customer users."
    );
  }

  return customer;
}
