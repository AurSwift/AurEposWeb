import { Session } from "next-auth";
import type { UserRole } from "@/types/next-auth";

/**
 * Role hierarchy definition
 * Higher values have more permissions
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  customer: 0,
  support: 1,
  developer: 2,
  admin: 3,
};

/**
 * Check if user has a specific role
 */
export function hasRole(session: Session | null, role: UserRole): boolean {
  if (!session?.user?.role) return false;
  return session.user.role === role;
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(session: Session | null, roles: UserRole[]): boolean {
  if (!session?.user?.role) return false;
  return roles.includes(session.user.role);
}

/**
 * Check if user has at least a minimum role level
 * @param session - User session
 * @param minRole - Minimum required role
 * @returns true if user has the minimum role or higher
 */
export function hasMinRole(session: Session | null, minRole: UserRole): boolean {
  if (!session?.user?.role) return false;
  return ROLE_HIERARCHY[session.user.role] >= ROLE_HIERARCHY[minRole];
}

/**
 * Check if user is a customer
 */
export function isCustomer(session: Session | null): boolean {
  return hasRole(session, "customer");
}

/**
 * Check if user is support staff
 */
export function isSupport(session: Session | null): boolean {
  return hasMinRole(session, "support");
}

/**
 * Check if user is a developer
 */
export function isDeveloper(session: Session | null): boolean {
  return hasMinRole(session, "developer");
}

/**
 * Check if user is an admin
 */
export function isAdmin(session: Session | null): boolean {
  return hasRole(session, "admin");
}

/**
 * Check if user is internal staff (admin, support, or developer)
 */
export function isInternalUser(session: Session | null): boolean {
  return hasAnyRole(session, ["admin", "support", "developer"]);
}

/**
 * Get user role or return null if not authenticated
 */
export function getUserRole(session: Session | null): UserRole | null {
  return session?.user?.role || null;
}

