import { Session } from "next-auth";
import { db } from "@/lib/db";
import {
  permissions,
  rolePermissions,
  userPermissions,
} from "@/lib/db/schema";
import { eq, and, or, gt } from "drizzle-orm";

/**
 * Get all permissions for a user based on their role and custom permissions
 * @param userId - User ID
 * @param role - User role
 * @returns Array of permission names
 */
export async function getUserPermissions(
  userId: string,
  role: string
): Promise<string[]> {
  // Get role-based permissions
  const rolePerms = await db
    .select({
      name: permissions.name,
    })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.role, role));

  // Get user-specific permissions (that haven't expired)
  const userPerms = await db
    .select({
      name: permissions.name,
    })
    .from(userPermissions)
    .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
    .where(
      and(
        eq(userPermissions.userId, userId),
        or(
          eq(userPermissions.expiresAt, null),
          gt(userPermissions.expiresAt, new Date())
        )
      )
    );

  // Combine and deduplicate
  const allPermissions = [
    ...rolePerms.map((p) => p.name),
    ...userPerms.map((p) => p.name),
  ];

  return [...new Set(allPermissions)];
}

/**
 * Check if user has a specific permission
 * @param session - User session
 * @param permissionName - Permission to check (e.g., "customers.read")
 * @returns true if user has permission
 */
export async function hasPermission(
  session: Session | null,
  permissionName: string
): Promise<boolean> {
  if (!session?.user?.id || !session?.user?.role) return false;

  // Admin has all permissions
  if (session.user.role === "admin") return true;

  const userPermissions = await getUserPermissions(
    session.user.id,
    session.user.role
  );

  return userPermissions.includes(permissionName);
}

/**
 * Check if user has ANY of the specified permissions
 * @param session - User session
 * @param permissionNames - Array of permissions to check
 * @returns true if user has at least one permission
 */
export async function hasAnyPermission(
  session: Session | null,
  permissionNames: string[]
): Promise<boolean> {
  if (!session?.user?.id || !session?.user?.role) return false;

  // Admin has all permissions
  if (session.user.role === "admin") return true;

  const userPermissions = await getUserPermissions(
    session.user.id,
    session.user.role
  );

  return permissionNames.some((perm) => userPermissions.includes(perm));
}

/**
 * Check if user has ALL of the specified permissions
 * @param session - User session
 * @param permissionNames - Array of permissions to check
 * @returns true if user has all permissions
 */
export async function hasAllPermissions(
  session: Session | null,
  permissionNames: string[]
): Promise<boolean> {
  if (!session?.user?.id || !session?.user?.role) return false;

  // Admin has all permissions
  if (session.user.role === "admin") return true;

  const userPermissions = await getUserPermissions(
    session.user.id,
    session.user.role
  );

  return permissionNames.every((perm) => userPermissions.includes(perm));
}

/**
 * Check if user can perform action on resource
 * @param session - User session
 * @param resource - Resource type (e.g., "customers", "licenses")
 * @param action - Action type (e.g., "read", "write", "delete")
 * @returns true if user has permission
 */
export async function canPerformAction(
  session: Session | null,
  resource: string,
  action: string
): Promise<boolean> {
  const permissionName = `${resource}.${action}`;
  return hasPermission(session, permissionName);
}

/**
 * Grant custom permission to user
 * @param userId - User to grant permission to
 * @param permissionName - Permission name
 * @param grantedBy - User granting the permission
 * @param expiresAt - Optional expiry date
 * @param reason - Reason for granting permission
 */
export async function grantUserPermission(
  userId: string,
  permissionName: string,
  grantedBy: string,
  expiresAt?: Date,
  reason?: string
): Promise<void> {
  // Find permission by name
  const [permission] = await db
    .select()
    .from(permissions)
    .where(eq(permissions.name, permissionName))
    .limit(1);

  if (!permission) {
    throw new Error(`Permission '${permissionName}' not found`);
  }

  // Check if permission already exists
  const existing = await db
    .select()
    .from(userPermissions)
    .where(
      and(
        eq(userPermissions.userId, userId),
        eq(userPermissions.permissionId, permission.id)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing permission
    await db
      .update(userPermissions)
      .set({
        expiresAt: expiresAt || null,
        reason: reason || null,
      })
      .where(eq(userPermissions.id, existing[0].id));
  } else {
    // Create new permission
    await db.insert(userPermissions).values({
      userId,
      permissionId: permission.id,
      grantedBy,
      expiresAt: expiresAt || null,
      reason: reason || null,
    });
  }
}

/**
 * Revoke custom permission from user
 * @param userId - User ID
 * @param permissionName - Permission to revoke
 */
export async function revokeUserPermission(
  userId: string,
  permissionName: string
): Promise<void> {
  // Find permission by name
  const [permission] = await db
    .select()
    .from(permissions)
    .where(eq(permissions.name, permissionName))
    .limit(1);

  if (!permission) {
    throw new Error(`Permission '${permissionName}' not found`);
  }

  // Delete user permission
  await db
    .delete(userPermissions)
    .where(
      and(
        eq(userPermissions.userId, userId),
        eq(userPermissions.permissionId, permission.id)
      )
    );
}

/**
 * Permission constants for easy reference
 */
export const PERMISSIONS = {
  // Customers
  CUSTOMERS_READ_ALL: "customers.read_all",
  CUSTOMERS_READ_OWN: "customers.read_own",
  CUSTOMERS_WRITE: "customers.write",
  CUSTOMERS_DELETE: "customers.delete",
  CUSTOMERS_EXPORT: "customers.export",

  // Subscriptions
  SUBSCRIPTIONS_READ_ALL: "subscriptions.read_all",
  SUBSCRIPTIONS_READ_OWN: "subscriptions.read_own",
  SUBSCRIPTIONS_CREATE: "subscriptions.create",
  SUBSCRIPTIONS_CANCEL: "subscriptions.cancel",
  SUBSCRIPTIONS_MODIFY: "subscriptions.modify",
  SUBSCRIPTIONS_REFUND: "subscriptions.refund",

  // Licenses
  LICENSES_READ_ALL: "licenses.read_all",
  LICENSES_READ_OWN: "licenses.read_own",
  LICENSES_CREATE: "licenses.create",
  LICENSES_REVOKE: "licenses.revoke",
  LICENSES_ACTIVATE: "licenses.activate",

  // Support
  SUPPORT_CREATE_TICKET: "support.create_ticket",
  SUPPORT_READ_ALL: "support.read_all",
  SUPPORT_READ_OWN: "support.read_own",
  SUPPORT_RESPOND: "support.respond",
  SUPPORT_CLOSE: "support.close",

  // Billing
  BILLING_READ_ALL: "billing.read_all",
  BILLING_READ_OWN: "billing.read_own",
  BILLING_PROCESS_REFUND: "billing.process_refund",
  BILLING_VIEW_REPORTS: "billing.view_reports",

  // Admin
  ADMIN_ACCESS_DASHBOARD: "admin.access_dashboard",
  ADMIN_MANAGE_USERS: "admin.manage_users",
  ADMIN_VIEW_AUDIT_LOGS: "admin.view_audit_logs",
  ADMIN_SYSTEM_SETTINGS: "admin.system_settings",
} as const;

