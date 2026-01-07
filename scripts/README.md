# Database Management Scripts

This directory contains utility scripts for managing the AuraSwift database. These scripts are designed to help with development, testing, and maintenance tasks.

## 📁 Folder Structure

```
scripts/
├── db/                          # Database-related scripts
│   ├── cleanup-database.ts      # Delete records (keeps structure)
│   ├── drop-all-tables.ts       # Drop all tables (⚠️ EXTREME)
│   ├── count-db-records.ts      # Count table records
│   ├── seed-demo-user.ts        # Seed demo user
│   ├── create-admin-user.ts     # Create admin user
│   ├── check-license.ts         # Check license keys
│   ├── check-subscription.ts    # Check subscriptions
│   ├── migrate-license-keys.ts  # Migrate license keys
│   ├── generate-test-license.ts # Generate test licenses
│   ├── fix-basic-plan-price.ts  # Fix plan prices
│   ├── fix-stripe-metadata.ts   # Fix Stripe metadata
│   ├── apply-role-migration.ts  # Apply role migration
│   ├── apply-employees-migration.ts # Apply employees migration
│   └── README.md                # Quick reference for DB scripts
├── generate-demo-password.ts    # Generate password hash
├── QUICK_REFERENCE.md           # Quick command reference
└── README.md                    # This file (comprehensive guide)
```

## 🚨 Safety First

Before running any destructive operations:

1. **Always backup your database first**
2. **Test in development environment**
3. **Use `--dry-run` mode to preview changes**
4. **Never run cleanup scripts on production without extreme caution**

---

## Scripts Overview

### 1. Database Cleanup Script (`db/cleanup-database.ts`)

**Purpose**: Deletes all or selective records from database tables (keeps table structure).

### 2. Drop All Tables Script (`db/drop-all-tables.ts`)

**Purpose**: Drops all table structures from the database (extremely destructive).

**⚠️ WARNING**: This is even more destructive than cleanup - it removes the entire table structure, not just data!

**Use Cases**:

- Complete schema reset during development
- Fix corrupted migrations
- Start fresh with new schema
- Clean slate before major schema changes

#### Basic Usage

```bash
# Preview what would be dropped (ALWAYS RUN THIS FIRST!)
pnpm db:drop-tables:dry-run

# Interactive drop with confirmation
pnpm db:drop-tables

# Force drop with CASCADE (for tables with dependencies)
pnpm db:drop-tables --cascade

# Skip confirmation (very dangerous!)
pnpm db:drop-tables --force
```

#### After Dropping Tables

You'll need to recreate the schema:

```bash
# Option 1: Push schema from code (recommended for dev)
pnpm db:push

# Option 2: Run migrations
pnpm db:migrate

# Option 3: Then seed with demo data
pnpm tsx scripts/db/seed-demo-user.ts
```

#### Safety Features

- ✅ **Requires typing "DROP ALL TABLES"** for confirmation
- ✅ **Production detection** - Blocks production databases
- ✅ **Dry run mode** - Preview before executing
- ✅ **CASCADE support** - Handle foreign key dependencies
- ✅ **Post-drop verification** - Confirms tables were dropped

### 3. Database Record Counter (`db/count-db-records.ts`)

**Use Cases**:

- Reset development database to clean state
- Remove test data after testing
- Clear staging environment between test cycles
- Prepare database for fresh data import

#### Basic Usage

```bash
# Preview what would be deleted (RECOMMENDED FIRST STEP)
pnpm db:cleanup --dry-run

# Interactive cleanup with confirmation
pnpm db:cleanup

# Clean specific tables only
pnpm db:cleanup --tables="payments,webhookEvents"

# Preserve admin users while cleaning everything else
pnpm db:cleanup --preserve-admins

# Preserve specific user(s)
pnpm db:cleanup --preserve-user="admin@example.com"

# Skip confirmation (dangerous!)
pnpm db:cleanup --force
```

#### Advanced Options

```bash
# Combine multiple options
pnpm db:cleanup --dry-run --preserve-admins

# Clean specific tables while preserving users
pnpm db:cleanup --tables="webhookEvents,sessions" --preserve-user="test@example.com"

# Force cleanup on production (NOT RECOMMENDED)
pnpm db:cleanup --allow-production --force
```

#### Available Flags

| Flag                       | Description                             |
| -------------------------- | --------------------------------------- |
| `--dry-run`                | Preview changes without deleting data   |
| `--preserve-admins`        | Keep admin users and their related data |
| `--preserve-user="email"`  | Keep specific user and their data       |
| `--force`                  | Skip confirmation prompt                |
| `--tables="table1,table2"` | Only clean specified tables             |
| `--allow-production`       | Allow running on production database    |
| `-h, --help`               | Show help message                       |

#### Deletion Order

The script deletes data in the correct order to respect foreign key constraints:

1. `activations` (references licenseKeys)
2. `licenseKeys` (references customers, subscriptions)
3. `payments` (references customers, subscriptions)
4. `subscriptionChanges` (references subscriptions, customers)
5. `supportTickets` (references customers)
6. `subscriptions` (references customers)
7. `webhookEvents` (independent)
8. `customers` (references users)
9. `passwordResetTokens` (independent)
10. `verificationTokens` (independent)
11. `sessions` (references users)
12. `accounts` (references users)
13. `users` (last - has dependencies from many tables)

#### Safety Features

- ✅ **Environment validation** - Detects production databases
- ✅ **Confirmation prompt** - Requires typing "DELETE ALL DATA"
- ✅ **Dry run mode** - Preview before executing
- ✅ **Selective preservation** - Keep specific users/admins
- ✅ **Transaction support** - Automatic rollback on errors
- ✅ **Progress logging** - See what's being deleted
- ✅ **Summary report** - Review what was deleted

#### Examples

**Example 1: Safe Development Reset**

```bash
# Step 1: See what you have
pnpm db:count

# Step 2: Preview cleanup
pnpm db:cleanup:dry-run

# Step 3: Backup (optional but recommended)
pg_dump $DATABASE_URL > backup.sql

# Step 4: Cleanup with admin preservation
pnpm db:cleanup --preserve-admins

# Step 5: Verify
pnpm db:count
```

**Example 2: Clean Test Data Only**

```bash
# Clean only test-related tables
pnpm db:cleanup --tables="webhookEvents,sessions,verificationTokens"
```

**Example 3: Complete Fresh Start**

```bash
# Nuclear option - delete everything
pnpm db:cleanup --force
```

---

**Purpose**: Display count of records in all database tables without any risk of modification.

**Use Cases**:

- Quick database health check
- Monitor data growth
- Verify cleanup results
- Database size estimation
- Debugging and troubleshooting

#### Basic Usage

```bash
# Show all table counts
pnpm db:count

# Output as JSON (for scripts/automation)
pnpm db:count --json

# Count specific table only
pnpm db:count --table=users

# Group by category
pnpm db:count --by-category

# Hide empty tables
pnpm db:count --hide-empty
```

#### Available Flags

| Flag             | Description                                    |
| ---------------- | ---------------------------------------------- |
| `--json`         | Output results as JSON                         |
| `--table=<name>` | Count specific table only                      |
| `--hide-empty`   | Hide tables with 0 records                     |
| `--by-category`  | Group tables by category (business/auth/audit) |
| `-h, --help`     | Show help message                              |

#### Output Format

**Standard Output:**

```
📊 Database Record Counts
═════════════════════════════════════════════════════════════
Table Name                            Records       Category
─────────────────────────────────────────────────────────────
customers                                  15    💼 business
subscriptions                              23    💼 business
licenseKeys                                15    💼 business
activations                                45    💼 business
payments                                   89    💼 business
supportTickets                             12    💼 business
users                                      18    🔐 auth
accounts                                    3    🔐 auth
sessions                                    8    🔐 auth
verificationTokens                          0    🔐 auth
passwordResetTokens                         0    🔐 auth
subscriptionChanges                        34    📝 audit
webhookEvents                             156    📝 audit
═════════════════════════════════════════════════════════════
TOTAL                                     418
═════════════════════════════════════════════════════════════

📈 Detailed Statistics
─────────────────────────────────────────────────────────────

👥 Users by Role:
   customer                        15
   admin                            3

📦 Subscriptions by Status:
   active                          18
   trialing                         3
   past_due                         2
```

**JSON Output:**

```json
{
  "timestamp": "2026-01-06T10:30:00.000Z",
  "databaseUrl": "localhost:5432/auraswift",
  "tables": [
    { "name": "customers", "count": 15, "category": "business" },
    { "name": "users", "count": 18, "category": "auth" }
  ],
  "totals": {
    "allTables": 418,
    "business": 233,
    "auth": 29,
    "audit": 190
  }
}
```

#### Examples

**Example 1: Quick Health Check**

```bash
# See database state
pnpm db:count

# Show only tables with data
pnpm db:count --hide-empty
```

**Example 2: Integration with Scripts**

```bash
# Get JSON output for automation
pnpm db:count --json > db-stats.json

# Count specific table in script
USER_COUNT=$(pnpm db:count --table=users --json | jq '.count')
echo "Total users: $USER_COUNT"
```

**Example 3: Organized View**

```bash
# Group by category for better overview
pnpm db:count --by-category
```

---

## 🔄 Common Workflows

### Complete Database Reset (Schema + Data)

```bash
# 1. Preview what will be dropped
pnpm db:drop-tables:dry-run

# 2. Drop all tables
pnpm db:drop-tables

# 3. Recreate schema from code
pnpm db:push

# 4. Seed with demo data
pnpm tsx scripts/db/seed-demo-user.ts

# 5. Verify
pnpm db:count
```

### Development Database Reset (Data Only)

```bash
# 1. Check current state
pnpm db:count

# 2. Preview cleanup (keep admins)
pnpm db:cleanup --dry-run --preserve-admins

# 3. Execute cleanup
pnpm db:cleanup --preserve-admins

# 4. Verify clean state
pnpm db:count

# 5. (Optional) Reseed with demo data
pnpm tsx scripts/db/seed-demo-user.ts
```

### Before/After Testing

```bash
# Before: Baseline count
pnpm db:count > before.txt

# ... run your tests ...

# After: Compare changes
pnpm db:count > after.txt
diff before.txt after.txt
```

### Clean Audit Tables Only

```bash
# Remove old webhooks and subscription changes
pnpm db:cleanup --tables="webhookEvents,subscriptionChanges"
```

### Production Database Maintenance

```bash
# ⚠️ EXTREME CAUTION REQUIRED ⚠️

# 1. BACKUP FIRST!
pg_dump $PRODUCTION_DATABASE_URL > production-backup-$(date +%Y%m%d).sql

# 2. Verify backup
ls -lh production-backup-*.sql

# 3. Only clean specific tables
pnpm db:cleanup --allow-production --tables="webhookEvents" --dry-run

# 4. If dry-run looks good, execute
pnpm db:cleanup --allow-production --tables="webhookEvents"
```

---

## 📊 Table Categories

### Business Tables

Core business data including customers, subscriptions, licenses, payments.

- `customers` - Customer accounts
- `subscriptions` - Active/past subscriptions
- `licenseKeys` - Software license keys
- `activations` - Terminal activations
- `payments` - Payment transactions
- `supportTickets` - Customer support tickets

### Authentication Tables

User authentication and session management (NextAuth.js).

- `users` - User accounts
- `accounts` - OAuth provider accounts
- `sessions` - Active user sessions
- `verificationTokens` - Email verification tokens
- `passwordResetTokens` - Password reset tokens

### Audit Tables

System logs and change tracking.

- `subscriptionChanges` - Subscription modification history
- `webhookEvents` - Stripe webhook event logs

---

## 🔒 Security Considerations

### Environment Protection

The cleanup script includes several safety mechanisms:

1. **Production Detection** - Automatically detects production databases by checking:

   - `NODE_ENV=production`
   - Database URLs containing: `production`, `.amazonaws.com`, `heroku`, `render.com`, `railway.app`, `vercel.com`

2. **Confirmation Required** - User must type exactly `DELETE ALL DATA` to proceed

3. **Dry Run First** - Always test with `--dry-run` before actual deletion

### Best Practices

✅ **DO:**

- Use `--dry-run` before any cleanup operation
- Backup database before cleanup
- Test scripts in development first
- Use `--preserve-admins` to keep admin access
- Verify results with `db:count` after cleanup

❌ **DON'T:**

- Run cleanup on production without `--allow-production` flag
- Use `--force` unless you're absolutely certain
- Clean production database without backup
- Run cleanup scripts in automated CI/CD pipelines
- Share cleanup scripts with untrusted users

---

## 🆘 Troubleshooting

### Common Issues

**Issue: Foreign Key Constraint Violations**

```
Error: Foreign key constraint violation
```

**Solution**: The script handles deletion order automatically. This should not occur. If it does, check for circular references in schema.

**Issue: Cannot Connect to Database**

```
Error: DATABASE_URL environment variable is not set
```

**Solution**: Ensure `.env.local` file exists with valid `DATABASE_URL`.

**Issue: Production Database Blocked**

```
Error: This appears to be a PRODUCTION database!
```

**Solution**: This is intentional. Use `--allow-production` flag only if you're absolutely certain.

**Issue: Script Hangs at Confirmation**

```
Type 'DELETE ALL DATA' to confirm:
>
```

**Solution**: Type exactly `DELETE ALL DATA` (case-sensitive) or use `--force` flag to skip confirmation.

### Recovery from Accidental Deletion

If you accidentally deleted data:

1. **Restore from Backup** (if you created one):

   ```bash
   psql $DATABASE_URL < backup.sql
   ```

2. **Check Database Backups** (Vercel/Railway/Render usually have automatic backups):

   - Vercel: Check project settings → Storage
   - Railway: Check database backups tab
   - Render: Check database dashboard

3. **Contact Support** (for managed services):
   - Most cloud providers keep point-in-time backups for 7-30 days

---

## 🧪 Testing the Scripts

### Test in Safe Environment

```bash
# 1. Create test database
createdb auraswift_test

# 2. Set test database URL
export DATABASE_URL="postgresql://localhost/auraswift_test"

# 3. Run migrations
pnpm db:push

# 4. Seed with test data
pnpm tsx scripts/db/seed-demo-user.ts

# 5. Test cleanup dry-run
pnpm db:cleanup:dry-run

# 6. Test actual cleanup
pnpm db:cleanup --force

# 7. Verify empty
pnpm db:count
```

---

## 📝 Adding New Tables

When adding new tables to the schema:

1. **Update `db/cleanup-database.ts`:**

   - Add table to deletion order (respecting foreign keys)
   - Add count query in `countAllTables()`
   - Add deletion logic in `cleanupDatabase()`
   - Handle preserved users if applicable

2. **Update `db/count-db-records.ts`:**

   - Add table to `countAllTables()` array
   - Assign appropriate category (business/auth/audit)
   - Update `tableMap` for single-table counting

3. **Test:**
   - Run `pnpm db:count` to verify counting works
   - Run `pnpm db:cleanup:dry-run` to verify deletion order
   - Actually test cleanup in development

---

## 🔗 Related Scripts

### Other Utility Scripts

**Database Scripts** (in `scripts/db/`):

**Core Operations:**

- `cleanup-database.ts` - Delete all records (keeps table structure)
- `drop-all-tables.ts` - Drop all tables (removes structure)
- `count-db-records.ts` - Count records in all tables

**User & Data Management:**

- `create-admin-user.ts` - Create admin user account
- `seed-demo-user.ts` - Seed demo user with subscription

**License Management:**

- `generate-test-license.ts` - Generate test license keys
- `check-license.ts` - Check license keys
- `migrate-license-keys.ts` - Migrate license keys

**Subscription Management:**

- `check-subscription.ts` - Check subscription status
- `fix-basic-plan-price.ts` - Fix basic plan pricing
- `fix-stripe-metadata.ts` - Fix Stripe metadata issues

**Migrations:**

- `apply-role-migration.ts` - Apply role migrations
- `apply-employees-migration.ts` - Apply employees migration

**Utility Scripts** (in `scripts/`):

- `generate-demo-password.ts` - Generate password hashes

### Database Management Commands

```bash
# Generate migrations
pnpm db:generate

# Run migrations
pnpm db:migrate

# Push schema changes
pnpm db:push

# Open Drizzle Studio
pnpm db:studio
```

---

## 📚 Additional Resources

- [Quick Reference Guide](./QUICK_REFERENCE.md) - Fast lookup for common commands
- [DB Scripts Reference](./db/README.md) - Database scripts overview
- [Database Schema](../lib/db/schema.ts) - Table definitions
- [Database Configuration](../drizzle.config.ts) - Drizzle ORM config
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

## ⚖️ License

These scripts are part of the AuraSwift project and follow the same license.

---

## 🤝 Contributing

When modifying these scripts:

1. Maintain backward compatibility
2. Add appropriate error handling
3. Update this documentation
4. Test thoroughly in development
5. Follow existing code style

---

## 📞 Support

If you encounter issues with these scripts:

1. Check this documentation first
2. Review error messages carefully
3. Test in development environment
4. Check database connection and permissions
5. Contact the development team if issues persist

---

**Last Updated**: January 6, 2026
**Version**: 1.0.0
