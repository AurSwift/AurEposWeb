# User-Customer Link Migration Guide

## ✅ Implementation Complete

The one-to-one relationship between `users` and `customers` has been implemented.

## Changes Made

### 1. Schema Update (`lib/db/schema.ts`)

**Added to `customers` table:**
```typescript
userId: uuid("user_id")
  .references(() => users.id, { onDelete: "cascade" })
  .unique()
  .notNull(), // One customer per user (one-to-one relationship)
```

**Updated relations:**
- `customersRelations`: Added `user` relation
- `usersRelations`: Added `customer` relation

### 2. Code Updates

**`lib/auth-utils.ts`:**
- ✅ `createUser()`: Now links customer to user via `userId`
- ✅ `getUserData()`: Now uses `userId` relationship instead of email matching

**`scripts/seed-demo-user.ts`:**
- ✅ Updated to include `userId` when creating customer

## Database Migration Required

⚠️ **You need to run a migration to add the `userId` column to existing data.**

### Step 1: Generate Migration

```bash
cd web
pnpm db:generate
```

This will create a migration file in the `drizzle` directory.

### Step 2: Update Migration (Manual Step)

Before running the migration, you need to populate `userId` for existing customers. 

**Option A: If you have matching emails:**

Edit the generated migration file to include data migration:

```sql
-- Add column as nullable first
ALTER TABLE customers ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Populate userId by matching emails
UPDATE customers c
SET user_id = u.id
FROM users u
WHERE c.email = u.email;

-- Make it NOT NULL and add unique constraint
ALTER TABLE customers ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE customers ADD CONSTRAINT customers_user_id_unique UNIQUE (user_id);
```

**Option B: If you don't have matching data:**

You'll need to manually link users to customers or create new customer records.

### Step 3: Run Migration

```bash
pnpm db:push
# or
pnpm db:migrate
```

## Verification

After migration, verify the relationship:

```typescript
// Test query
const user = await db.query.users.findFirst({
  where: eq(users.email, "demo@company.com"),
  with: {
    customer: {
      with: {
        subscriptions: true,
        licenseKeys: true,
      },
    },
  },
});

console.log(user?.customer); // Should show customer data
```

## Benefits

✅ **Proper Foreign Key Relationship**
- Database enforces data integrity
- Cascade deletes work correctly

✅ **Better Queries**
- No more email matching
- Direct relationship queries
- Can use Drizzle relations

✅ **Type Safety**
- TypeScript knows about the relationship
- Better autocomplete

✅ **Performance**
- Indexed foreign key
- Faster joins

## Breaking Changes

⚠️ **Existing code that matches by email will break!**

If you have any code that does:
```typescript
// OLD - This won't work anymore
const customer = await db
  .select()
  .from(customers)
  .where(eq(customers.email, user.email))
```

**Update to:**
```typescript
// NEW - Use userId relationship
const customer = await db
  .select()
  .from(customers)
  .where(eq(customers.userId, user.id))
```

## Next Steps

1. ✅ Run database migration
2. ✅ Test user signup flow
3. ✅ Test user login and data retrieval
4. ✅ Verify dashboard shows correct data
5. ✅ Check seed script works

## Rollback (If Needed)

If you need to rollback:

```sql
ALTER TABLE customers DROP CONSTRAINT customers_user_id_unique;
ALTER TABLE customers DROP COLUMN user_id;
```

Then revert the code changes.

