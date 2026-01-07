# Database Scripts

This folder contains all database-related scripts for the AuraSwift web application.

## 📁 Scripts Overview

### Core Database Operations

- **`cleanup-database.ts`** - Clean all or selective database tables
- **`count-db-records.ts`** - Display record counts for all tables
- **`seed-demo-user.ts`** - Seed database with demo user data
- **`create-admin-user.ts`** - Create a new admin user account

### License Management

- **`check-license.ts`** - Check license key status and details
- **`generate-test-license.ts`** - Generate test license keys
- **`migrate-license-keys.ts`** - Migrate license key format/data

### Subscription Management

- **`check-subscription.ts`** - Check subscription status
- **`fix-basic-plan-price.ts`** - Fix basic plan pricing issues
- **`fix-stripe-metadata.ts`** - Update Stripe product metadata

### Database Migrations

- **`apply-role-migration.ts`** - Apply user role field migration
- **`apply-employees-migration.ts`** - Apply employees table migration

## 🚀 Quick Start

All scripts can be run from the `web` directory using the following commands:

### Using NPM Scripts (Recommended)

```bash
# Database cleanup (with safety features)
bun run db:cleanup                  # Interactive cleanup
bun run db:cleanup:dry-run          # Preview mode (safe)

# Database monitoring
bun run db:count                    # Count all records

# Migrations
bun run db:apply-roles              # Apply role migration
bun run db:apply-employees          # Apply employees migration

# User management
bun run admin:create                # Create admin user
```

### Running Scripts Directly

```bash
# From the web directory
pnpm tsx scripts/db/count-db-records.ts
pnpm tsx scripts/db/cleanup-database.ts --dry-run
pnpm tsx scripts/db/seed-demo-user.ts
```

## 📚 Detailed Documentation

For comprehensive documentation including:
- Complete usage instructions
- Safety guidelines and best practices
- Common workflows and examples
- Troubleshooting guides

See the main [Scripts README](../README.md)

## ⚠️ Important Notes

1. **Environment Variables**: All scripts automatically load `.env.local`
2. **Database Connection**: Ensure `DATABASE_URL` is set in `.env.local`
3. **Safety First**: Always use `--dry-run` before destructive operations
4. **Backups**: Create database backups before running migrations or cleanup

## 🔗 Related Files

- [Main Scripts README](../README.md) - Complete documentation
- [Database Schema](../../lib/db/schema.ts) - Database table definitions
- [Drizzle Config](../../drizzle.config.ts) - ORM configuration

## 📞 Need Help?

If you encounter issues:
1. Check environment variables are set correctly
2. Ensure database connection works (`bun run db:count`)
3. Review the main [Scripts README](../README.md)
4. Check script-specific error messages

