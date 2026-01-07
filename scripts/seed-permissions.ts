/**
 * Seed Permissions Script
 * 
 * This script populates the permissions and role_permissions tables
 * Run with: npm run db:seed-permissions
 */

import { db } from "@/lib/db";
import { permissions, rolePermissions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Define all permissions
const permissionsList = [
  // CUSTOMERS
  {
    name: "customers.read_all",
    description: "View all customer information",
    resource: "customers",
    action: "read_all",
  },
  {
    name: "customers.read_own",
    description: "View own customer information",
    resource: "customers",
    action: "read_own",
  },
  {
    name: "customers.write",
    description: "Modify customer information",
    resource: "customers",
    action: "write",
  },
  {
    name: "customers.delete",
    description: "Delete customer accounts",
    resource: "customers",
    action: "delete",
  },
  {
    name: "customers.export",
    description: "Export customer data",
    resource: "customers",
    action: "export",
  },

  // SUBSCRIPTIONS
  {
    name: "subscriptions.read_all",
    description: "View all subscriptions",
    resource: "subscriptions",
    action: "read_all",
  },
  {
    name: "subscriptions.read_own",
    description: "View own subscription",
    resource: "subscriptions",
    action: "read_own",
  },
  {
    name: "subscriptions.create",
    description: "Create new subscriptions",
    resource: "subscriptions",
    action: "create",
  },
  {
    name: "subscriptions.cancel",
    description: "Cancel subscriptions",
    resource: "subscriptions",
    action: "cancel",
  },
  {
    name: "subscriptions.modify",
    description: "Modify subscription details",
    resource: "subscriptions",
    action: "modify",
  },
  {
    name: "subscriptions.refund",
    description: "Process subscription refunds",
    resource: "subscriptions",
    action: "refund",
  },

  // LICENSES
  {
    name: "licenses.read_all",
    description: "View all license keys",
    resource: "licenses",
    action: "read_all",
  },
  {
    name: "licenses.read_own",
    description: "View own license keys",
    resource: "licenses",
    action: "read_own",
  },
  {
    name: "licenses.create",
    description: "Create new license keys",
    resource: "licenses",
    action: "create",
  },
  {
    name: "licenses.revoke",
    description: "Revoke license keys",
    resource: "licenses",
    action: "revoke",
  },
  {
    name: "licenses.activate",
    description: "Activate license keys",
    resource: "licenses",
    action: "activate",
  },

  // SUPPORT
  {
    name: "support.create_ticket",
    description: "Create support tickets",
    resource: "support",
    action: "create_ticket",
  },
  {
    name: "support.read_all",
    description: "View all support tickets",
    resource: "support",
    action: "read_all",
  },
  {
    name: "support.read_own",
    description: "View own support tickets",
    resource: "support",
    action: "read_own",
  },
  {
    name: "support.respond",
    description: "Respond to support tickets",
    resource: "support",
    action: "respond",
  },
  {
    name: "support.close",
    description: "Close support tickets",
    resource: "support",
    action: "close",
  },

  // BILLING
  {
    name: "billing.read_all",
    description: "View all billing information",
    resource: "billing",
    action: "read_all",
  },
  {
    name: "billing.read_own",
    description: "View own billing information",
    resource: "billing",
    action: "read_own",
  },
  {
    name: "billing.process_refund",
    description: "Process billing refunds",
    resource: "billing",
    action: "process_refund",
  },
  {
    name: "billing.view_reports",
    description: "View billing reports",
    resource: "billing",
    action: "view_reports",
  },

  // ADMIN
  {
    name: "admin.access_dashboard",
    description: "Access admin dashboard",
    resource: "admin",
    action: "access_dashboard",
  },
  {
    name: "admin.manage_users",
    description: "Manage user accounts",
    resource: "admin",
    action: "manage_users",
  },
  {
    name: "admin.view_audit_logs",
    description: "View system audit logs",
    resource: "admin",
    action: "view_audit_logs",
  },
  {
    name: "admin.system_settings",
    description: "Modify system settings",
    resource: "admin",
    action: "system_settings",
  },
];

// Define role-permission mappings
// Note: Admin gets ALL permissions, so we don't need to map them all
const rolePermissionMappings = {
  // CUSTOMER permissions (read own data only)
  customer: [
    "customers.read_own",
    "subscriptions.read_own",
    "subscriptions.create",
    "subscriptions.cancel",
    "licenses.read_own",
    "licenses.activate",
    "support.create_ticket",
    "support.read_own",
    "billing.read_own",
  ],

  // SUPPORT permissions (read all, respond to tickets, but no financial operations)
  support: [
    "customers.read_all",
    "customers.export",
    "subscriptions.read_all",
    "licenses.read_all",
    "support.create_ticket",
    "support.read_all",
    "support.respond",
    "support.close",
    "admin.access_dashboard",
  ],

  // DEVELOPER permissions (technical access, no customer data modifications)
  developer: [
    "customers.read_all",
    "subscriptions.read_all",
    "licenses.read_all",
    "support.read_all",
    "billing.view_reports",
    "admin.access_dashboard",
    "admin.view_audit_logs",
  ],

  // Note: ADMIN gets all permissions automatically in the permission checking logic
  // So we don't need to map all permissions to admin role
};

async function seedPermissions() {
  try {
    console.log("🌱 Starting permission seeding...\n");

    // 1. Insert all permissions
    console.log("📝 Creating permissions...");
    const createdPermissions = [];

    for (const perm of permissionsList) {
      // Check if permission already exists
      const existing = await db
        .select()
        .from(permissions)
        .where(eq(permissions.name, perm.name))
        .limit(1);

      if (existing.length > 0) {
        console.log(`  ⏭️  Permission '${perm.name}' already exists`);
        createdPermissions.push(existing[0]);
      } else {
        const [created] = await db
          .insert(permissions)
          .values(perm)
          .returning();
        console.log(`  ✅ Created permission: ${perm.name}`);
        createdPermissions.push(created);
      }
    }

    console.log(`\n✅ Created/verified ${createdPermissions.length} permissions`);

    // 2. Map permissions to roles
    console.log("\n📝 Mapping permissions to roles...");

    for (const [role, permNames] of Object.entries(rolePermissionMappings)) {
      console.log(`\n  Role: ${role}`);

      for (const permName of permNames) {
        const permission = createdPermissions.find((p) => p.name === permName);

        if (!permission) {
          console.log(`    ⚠️  Permission '${permName}' not found!`);
          continue;
        }

        // Check if mapping already exists
        const existing = await db
          .select()
          .from(rolePermissions)
          .where(
            eq(rolePermissions.role, role),
            eq(rolePermissions.permissionId, permission.id)
          )
          .limit(1);

        if (existing.length > 0) {
          console.log(`    ⏭️  Mapping for '${permName}' already exists`);
        } else {
          await db.insert(rolePermissions).values({
            role,
            permissionId: permission.id,
          });
          console.log(`    ✅ Mapped: ${permName}`);
        }
      }
    }

    console.log("\n✅ Permission seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`  - Total permissions: ${permissionsList.length}`);
    console.log(`  - Customer permissions: ${rolePermissionMappings.customer.length}`);
    console.log(`  - Support permissions: ${rolePermissionMappings.support.length}`);
    console.log(`  - Developer permissions: ${rolePermissionMappings.developer.length}`);
    console.log(`  - Admin permissions: ALL (checked automatically)`);

    console.log("\n🎯 Startup Note:");
    console.log("  - For now, only use 'admin' and 'customer' roles");
    console.log("  - Admin has ALL permissions automatically");
    console.log("  - Customer permissions are limited to own data");
    console.log("  - Support/Developer roles are ready when you need them");
  } catch (error) {
    console.error("\n❌ Error seeding permissions:");
    console.error(error);
    process.exit(1);
  }
}

seedPermissions();

