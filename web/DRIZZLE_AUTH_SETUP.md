# NextAuth.js with Drizzle ORM Adapter - Setup Guide

This project now uses the **Drizzle ORM adapter** for NextAuth.js v5, providing database-backed session management and OAuth provider support.

## What Changed

### 1. Database Schema Updates

Added NextAuth.js required tables:
- **`accounts`** - OAuth provider accounts (Google, GitHub, etc.)
- **`sessions`** - Database-backed user sessions
- **`verificationTokens`** - Email verification and magic link tokens

Updated **`users`** table:
- Added `image` field for user avatars
- Made `password` optional (for OAuth users)
- Updated `emailVerified` to use proper timestamp mode

### 2. Authentication Configuration

- **Session Strategy**: Changed from `jwt` to `database`
- **Adapter**: Integrated `DrizzleAdapter` for automatic session management
- **Credentials Provider**: Still works for email/password authentication

## Installation

1. **Install the adapter package:**
   ```bash
   pnpm install
   ```
   (The `@auth/drizzle-adapter` package has been added to `package.json`)

2. **Run database migrations:**
   ```bash
   pnpm db:push
   # or
   pnpm db:migrate
   ```

   This will create the new tables:
   - `accounts`
   - `sessions`
   - `verification_tokens`

## Database Schema

### Users Table
```typescript
users {
  id: uuid (primary key)
  email: varchar (unique, not null)
  emailVerified: timestamp (nullable)
  name: varchar (nullable)
  image: varchar (nullable) // NEW
  password: text (nullable) // Now optional for OAuth users
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Accounts Table (NEW)
```typescript
accounts {
  id: uuid (primary key)
  userId: uuid (foreign key -> users.id)
  type: varchar (e.g., "oauth", "email")
  provider: varchar (e.g., "google", "github")
  providerAccountId: varchar
  refreshToken: text
  accessToken: text
  expiresAt: integer
  tokenType: varchar
  scope: varchar
  idToken: text
  sessionState: varchar
}
```

### Sessions Table (NEW)
```typescript
sessions {
  id: uuid (primary key)
  sessionToken: varchar (unique, not null)
  userId: uuid (foreign key -> users.id)
  expires: timestamp (not null)
}
```

### Verification Tokens Table (NEW)
```typescript
verification_tokens {
  identifier: varchar (part of composite primary key)
  token: varchar (part of composite primary key)
  expires: timestamp
}
```

## How It Works

### Database Sessions

With the Drizzle adapter, sessions are stored in the database instead of JWT tokens:

1. **User logs in** → Session record created in `sessions` table
2. **Session token** → Stored in HTTP-only cookie
3. **Session lookup** → NextAuth queries database on each request
4. **Session expiry** → Automatically handled by adapter

### Credentials Provider

The email/password authentication still works:

```typescript
// User signs up → User created in database
// User logs in → Credentials provider validates password
// Session created → Stored in database via adapter
```

### OAuth Providers (Future)

You can now easily add OAuth providers:

```typescript
// In auth.ts
import Google from "next-auth/providers/google";

providers: [
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }),
  // ... other providers
]
```

## Migration from JWT to Database Sessions

### What Changed in Code

**Before (JWT):**
```typescript
session: {
  strategy: "jwt",
},
callbacks: {
  jwt({ token, user }) { ... },
  session({ session, token }) { ... },
}
```

**After (Database):**
```typescript
adapter: DrizzleAdapter(db, {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
}),
session: {
  strategy: "database",
},
callbacks: {
  session({ session, user }) { ... }, // user instead of token
}
```

### Session Callback Changes

**Before:**
```typescript
async session({ session, token }) {
  session.user.id = token.id;
  // ...
}
```

**After:**
```typescript
async session({ session, user }) {
  session.user.id = user.id; // user object from database
  // ...
}
```

## Benefits

1. **Persistent Sessions**: Sessions survive server restarts
2. **Session Management**: Can view/revoke sessions in database
3. **OAuth Ready**: Easy to add Google, GitHub, etc.
4. **Better Security**: Sessions stored securely in database
5. **Scalability**: Works with multiple server instances

## Testing

1. **Test Login:**
   ```bash
   pnpm dev
   # Navigate to /login
   # Login with existing credentials
   ```

2. **Check Database:**
   ```bash
   pnpm db:studio
   # View sessions table to see active sessions
   ```

3. **Test Signup:**
   ```bash
   # Navigate to /signup
   # Create new user
   # Verify user and session created in database
   ```

## Troubleshooting

### "Cannot find module '@auth/drizzle-adapter'"
```bash
pnpm install
```

### "Table 'sessions' does not exist"
```bash
pnpm db:push
# or
pnpm db:migrate
```

### Sessions not persisting
- Check `DATABASE_URL` is set correctly
- Verify tables exist: `accounts`, `sessions`, `verification_tokens`
- Check database connection is working

### Old JWT sessions not working
- Users need to log in again (sessions are now in database)
- Clear browser cookies if needed

## Next Steps

1. **Add OAuth Providers** (optional):
   - Google OAuth
   - GitHub OAuth
   - etc.

2. **Session Management UI** (optional):
   - View active sessions
   - Revoke sessions
   - Session history

3. **Email Verification** (optional):
   - Use `verificationTokens` table
   - Send verification emails
   - Verify email on signup

## Files Modified

- ✅ `package.json` - Added `@auth/drizzle-adapter`
- ✅ `lib/db/schema.ts` - Added NextAuth tables
- ✅ `auth.ts` - Integrated DrizzleAdapter
- ✅ `auth.config.ts` - Updated for database sessions
- ✅ `lib/db/index.ts` - Exported schema tables

## References

- [NextAuth.js v5 Docs](https://authjs.dev/)
- [Drizzle Adapter Docs](https://authjs.dev/reference/adapter/drizzle)
- [Drizzle ORM Docs](https://orm.drizzle.team/)

