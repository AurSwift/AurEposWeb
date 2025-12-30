# Neon PostgreSQL Database Setup

## Connection String

Your Neon PostgreSQL connection string has been configured:

```
postgresql://neondb_owner:npg_tHcjA0qQSz7I@ep-sparkling-band-ab9ocxue-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

## Setup Instructions

### 1. Create `.env.local` File

Create a `.env.local` file in the `web/` directory:

```bash
cd web
touch .env.local
```

### 2. Add Database URL

Add your Neon connection string to `.env.local`:

```env
# Neon PostgreSQL Database
DATABASE_URL=postgresql://neondb_owner:npg_tHcjA0qQSz7I@ep-sparkling-band-ab9ocxue-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# NextAuth.js Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here-generate-a-secure-random-string

# Resend Email Service
RESEND_API_KEY=re_your_resend_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

### 3. Generate NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

Copy the output and paste it as `NEXTAUTH_SECRET` value.

### 4. Test Connection

```bash
# Test with Drizzle Studio
pnpm db:studio

# Or test with a simple query
pnpm db:push
```

## Connection String Details

### Components:

- **Host:** `ep-sparkling-band-ab9ocxue-pooler.eu-west-2.aws.neon.tech`
- **Database:** `neondb`
- **User:** `neondb_owner`
- **Password:** `npg_tHcjA0qQSz7I`
- **Pooler:** Using Neon's connection pooler (recommended for serverless)
- **SSL:** Required (`sslmode=require`)
- **Region:** `eu-west-2` (London)

### Why Pooler?

- ✅ Better for serverless/Next.js
- ✅ Handles connection pooling automatically
- ✅ Reduces connection overhead
- ✅ Recommended for production

## Database Configuration

### Current Setup:

- **ORM:** Drizzle ORM
- **Client:** postgres-js
- **Connection:** Lazy initialization (only connects when needed)
- **Pooling:** Handled by Neon pooler

### Files Using DATABASE_URL:

1. `lib/db/index.ts` - Database connection
2. `drizzle.config.ts` - Drizzle Kit configuration
3. `auth/index.ts` - NextAuth adapter

## Next Steps

1. ✅ Add connection string to `.env.local`
2. ✅ Generate and add `NEXTAUTH_SECRET`
3. ✅ Add Resend API key (if using email features)
4. ✅ Run database migrations:
   ```bash
   pnpm db:push
   ```
5. ✅ Seed demo data (optional):
   ```bash
   pnpm tsx scripts/seed-demo-user.ts
   ```

## Troubleshooting

### Connection Issues

**Error: "Connection refused"**

- Check if connection string is correct
- Verify Neon database is active
- Check firewall/network settings

**Error: "SSL required"**

- Connection string already includes `sslmode=require` ✅
- Should work automatically

**Error: "Database does not exist"**

- Verify database name is `neondb`
- Check Neon dashboard

### Migration Issues

**Error: "Table already exists"**

- Database might have existing tables
- Use `pnpm db:push` to sync schema
- Or drop tables manually if needed

## Security Notes

⚠️ **Important:**

- Never commit `.env.local` to git (already in `.gitignore`)
- Keep connection string secure
- Rotate password periodically in Neon dashboard
- Use different credentials for production

## Neon Dashboard

Access your database:

- Dashboard: https://console.neon.tech
- Monitor connections, queries, and performance
- View database logs
- Manage credentials

## Production Considerations

For production deployment (Vercel, etc.):

1. **Add to Environment Variables:**

   - Go to your hosting platform's settings
   - Add `DATABASE_URL` with your Neon connection string
   - Add other required environment variables

2. **Use Direct Connection (Optional):**

   - For production, you might want to use direct connection instead of pooler
   - Direct: `ep-sparkling-band-ab9ocxue.eu-west-2.aws.neon.tech` (no `-pooler`)
   - Pooler (current): Better for serverless, handles pooling automatically

3. **Connection Limits:**
   - Neon free tier: Limited connections
   - Pooler helps manage connections efficiently
   - Monitor usage in Neon dashboard

## Verification

Test the connection:

```typescript
// In a test file or API route
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

// Simple query
const result = await db.select().from(users).limit(1);
console.log("Connection successful!", result);
```
