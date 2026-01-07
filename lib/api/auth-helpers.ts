import { auth } from "@/auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import type { Session } from "next-auth";

// Re-export role-based auth helpers
export {
  requireAuth,
  requireRole,
  requireAnyRole,
  requireMinRole,
  requireAdmin,
  requireInternalUser,
  requireCustomer,
  UnauthorizedError,
  ForbiddenError,
  createUnauthorizedResponse,
  createForbiddenResponse,
} from "./role-middleware";

// Import for local use
import { UnauthorizedError } from "./role-middleware";

/**
 * Require authentication using getServerSession (alternative method)
 * Use when explicit authOptions are needed
 *
 * @returns Authenticated session
 * @throws {UnauthorizedError} If user is not authenticated
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   try {
 *     const session = await requireAuthWithOptions();
 *     // Proceed with authenticated user
 *   } catch (error) {
 *     if (error instanceof UnauthorizedError) {
 *       return NextResponse.json({ error: error.message }, { status: 401 });
 *     }
 *     throw error;
 *   }
 * }
 */
export async function requireAuthWithOptions(): Promise<Session> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new UnauthorizedError(
      "Authentication required. Please log in to continue."
    );
  }

  return session;
}

/**
 * Get optional session (doesn't throw if not authenticated)
 * Use when authentication is optional
 *
 * @returns Session or null if not authenticated
 *
 * @example
 * const session = await getOptionalSession();
 * if (session) {
 *   // User is logged in
 * } else {
 *   // User is guest
 * }
 */
export async function getOptionalSession(): Promise<Session | null> {
  try {
    const session = await auth();
    return session;
  } catch (error) {
    console.error("Error getting optional session:", error);
    return null;
  }
}

/**
 * Check if user is authenticated without throwing
 *
 * @returns True if authenticated, false otherwise
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getOptionalSession();
  return !!session?.user?.id;
}
