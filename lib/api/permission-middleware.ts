import { Session } from "next-auth";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canPerformAction,
} from "@/lib/auth/permissions";
import { ForbiddenError, UnauthorizedError } from "./role-middleware";

/**
 * Require specific permission
 * Throws ForbiddenError if user doesn't have the permission
 */
export async function requirePermission(permission: string): Promise<Session> {
  const session = await auth();

  if (!session || !session.user) {
    throw new UnauthorizedError("Authentication required");
  }

  const allowed = await hasPermission(session, permission);

  if (!allowed) {
    throw new ForbiddenError(
      `Access denied. This endpoint requires permission: ${permission}`
    );
  }

  return session;
}

/**
 * Require any of the specified permissions
 * Throws ForbiddenError if user doesn't have at least one permission
 */
export async function requireAnyPermission(
  permissionList: string[]
): Promise<Session> {
  const session = await auth();

  if (!session || !session.user) {
    throw new UnauthorizedError("Authentication required");
  }

  const allowed = await hasAnyPermission(session, permissionList);

  if (!allowed) {
    throw new ForbiddenError(
      `Access denied. This endpoint requires one of: ${permissionList.join(", ")}`
    );
  }

  return session;
}

/**
 * Require all specified permissions
 * Throws ForbiddenError if user doesn't have all permissions
 */
export async function requireAllPermissions(
  permissionList: string[]
): Promise<Session> {
  const session = await auth();

  if (!session || !session.user) {
    throw new UnauthorizedError("Authentication required");
  }

  const allowed = await hasAllPermissions(session, permissionList);

  if (!allowed) {
    throw new ForbiddenError(
      `Access denied. This endpoint requires all of: ${permissionList.join(", ")}`
    );
  }

  return session;
}

/**
 * Require ability to perform action on resource
 * Throws ForbiddenError if user can't perform the action
 */
export async function requireAction(
  resource: string,
  action: string
): Promise<Session> {
  const session = await auth();

  if (!session || !session.user) {
    throw new UnauthorizedError("Authentication required");
  }

  const allowed = await canPerformAction(session, resource, action);

  if (!allowed) {
    throw new ForbiddenError(
      `Access denied. Cannot perform '${action}' on '${resource}'`
    );
  }

  return session;
}

/**
 * Check if session has permission (without throwing)
 * @param session - User session
 * @param permission - Permission to check
 * @returns true if user has permission
 */
export async function checkPermission(
  session: Session | null,
  permission: string
): Promise<boolean> {
  if (!session) return false;
  return hasPermission(session, permission);
}

/**
 * Create a forbidden response for permission denial
 * Returns NextResponse with 403
 */
export function createPermissionDeniedResponse(
  permission: string
): NextResponse {
  return NextResponse.json(
    {
      error: "Forbidden",
      message: `Access denied. Missing permission: ${permission}`,
    },
    { status: 403 }
  );
}

