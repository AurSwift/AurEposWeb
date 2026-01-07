import { Session } from "next-auth";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { UserRole } from "@/types/next-auth";
import {
  hasRole,
  hasAnyRole,
  hasMinRole,
  isInternalUser,
} from "@/lib/auth/role-helpers";

/**
 * Error class for authorization failures (role-based)
 */
export class ForbiddenError extends Error {
  public readonly statusCode = 403;

  constructor(message: string = "Forbidden - Insufficient permissions") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Error class for authentication failures
 */
export class UnauthorizedError extends Error {
  public readonly statusCode = 401;

  constructor(message: string = "Unauthorized - Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Require authentication and return session
 * Throws error if not authenticated
 */
export async function requireAuth(): Promise<Session> {
  const session = await auth();

  if (!session || !session.user) {
    throw new UnauthorizedError(
      "Authentication required. Please log in to continue."
    );
  }

  return session;
}

/**
 * Require specific role
 * Throws ForbiddenError if user doesn't have the role
 */
export async function requireRole(role: UserRole): Promise<Session> {
  const session = await requireAuth();

  if (!hasRole(session, role)) {
    throw new ForbiddenError(
      `Access denied. This endpoint requires ${role} role.`
    );
  }

  return session;
}

/**
 * Require any of the specified roles
 * Throws ForbiddenError if user doesn't have any of the roles
 */
export async function requireAnyRole(roles: UserRole[]): Promise<Session> {
  const session = await requireAuth();

  if (!hasAnyRole(session, roles)) {
    throw new ForbiddenError(
      `Access denied. This endpoint requires one of: ${roles.join(", ")}`
    );
  }

  return session;
}

/**
 * Require minimum role level
 * Throws ForbiddenError if user doesn't meet minimum role requirement
 */
export async function requireMinRole(minRole: UserRole): Promise<Session> {
  const session = await requireAuth();

  if (!hasMinRole(session, minRole)) {
    throw new ForbiddenError(
      `Access denied. This endpoint requires at least ${minRole} role.`
    );
  }

  return session;
}

/**
 * Require admin role
 */
export async function requireAdmin(): Promise<Session> {
  return requireRole("admin");
}

/**
 * Require internal user (admin, support, or developer)
 */
export async function requireInternalUser(): Promise<Session> {
  const session = await requireAuth();

  if (!isInternalUser(session)) {
    throw new ForbiddenError(
      "Access denied. This endpoint is only available to internal users."
    );
  }

  return session;
}

/**
 * Require customer role
 */
export async function requireCustomer(): Promise<Session> {
  return requireRole("customer");
}

/**
 * Create a forbidden response
 * Returns NextResponse with 403 for insufficient permissions
 */
export function createForbiddenResponse(
  message: string = "Forbidden - Insufficient permissions"
): NextResponse {
  return NextResponse.json(
    {
      error: "Forbidden",
      message,
    },
    { status: 403 }
  );
}

/**
 * Create an unauthorized response
 * Returns NextResponse with 401 for authentication failures
 */
export function createUnauthorizedResponse(
  message: string = "Unauthorized - Authentication required"
): NextResponse {
  return NextResponse.json(
    {
      error: "Unauthorized",
      message,
    },
    { status: 401 }
  );
}

