# Employee Onboarding Best Practices

## Overview

This guide explains the best practices for employee/admin authentication and provides implementation options.

## Current Setup ✅

### Login (Unified)
- **URL**: `http://localhost:3000/login`
- **Who**: Both customers AND employees/admins
- **How**: Same login form, role stored in database

### Signup (Separated)
- **Customers**: `/signup` → email verification → login
- **Employees**: Manual creation via script → auto-verified → login

## 🔒 Security Principles

### Rule #1: Employees Cannot Self-Register
**Why?** Public employee signup = security vulnerability
- Random people could claim to be employees
- Employee access should be tightly controlled
- Only admins should create employee accounts

### Rule #2: Email Verification Strategy
**Two valid approaches:**
1. **Manual Creation**: Auto-verify (admin is trusted)
2. **Invitation System**: Verify via invite link acceptance

## 📊 Implementation Options

### Option 1: Manual Creation (Current - Startup Friendly)

#### When to Use
- Team size: 1-10 employees
- Early stage startup
- Need simple, secure solution
- Limited development time

#### How It Works
```bash
# Admin creates employee
npm run admin:create employee@company.com "Employee Name" "TempPassword123"

# Email is auto-verified ✅
# Admin shares credentials via Slack/1Password
```

#### Pros & Cons
✅ Simple and secure
✅ Full admin control
✅ No additional code needed
✅ Works immediately

❌ Doesn't scale
❌ Admin manages passwords
❌ No self-service

#### Best Practice Enhancements

**1. Force Password Change on First Login**

Add to your login flow:

```typescript
// auth/index.ts
async authorize(credentials) {
  const user = // ... get user
  
  // Check if this is first login
  if (user.role !== 'customer' && !user.lastPasswordChange) {
    // Set flag to force password change
    return {
      ...user,
      requirePasswordChange: true
    };
  }
  
  return user;
}
```

**2. Password Change Tracking**

Add to schema:
```sql
ALTER TABLE users ADD COLUMN last_password_change TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP WITH TIME ZONE;
```

**3. Secure Credential Sharing**
- ❌ Don't send via email (insecure)
- ❌ Don't send via Slack DM (readable)
- ✅ Use password manager (1Password, LastPass)
- ✅ Share via encrypted link (onetimesecret.com)

### Option 2: Invitation System (Recommended for Growth)

#### When to Use
- Team size: 10+ employees
- Planning to scale team
- Want professional UX
- Have development resources

#### How It Works

1. **Admin sends invite**
   - Admin enters employee email + role in dashboard
   - System generates secure invite token
   - Email sent with invite link

2. **Employee accepts invite**
   - Employee clicks invite link
   - Employee sets their own password
   - Email verified via invite acceptance
   - Account activated

3. **Employee logs in**
   - Uses `/login` like customers
   - Credentials they set themselves

#### Implementation

**Step 1: Add Invite Tokens Table**

```sql
CREATE TABLE employee_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL, -- 'admin', 'support', 'developer'
  token TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES users(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX employee_invites_token_idx ON employee_invites(token);
CREATE INDEX employee_invites_email_idx ON employee_invites(email);
```

**Step 2: Add Drizzle Schema**

```typescript
// lib/db/schema.ts
export const employeeInvites = pgTable(
  "employee_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    role: varchar("role", { length: 20 }).notNull(), // 'admin', 'support', 'developer'
    token: text("token").notNull().unique(),
    invitedBy: uuid("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tokenIdx: index("employee_invites_token_idx").on(table.token),
    emailIdx: index("employee_invites_email_idx").on(table.email),
  })
);
```

**Step 3: Create Invite API**

```typescript
// app/api/admin/employees/invite/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/auth-helpers";
import { db } from "@/lib/db";
import { employeeInvites, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { sendEmployeeInviteEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const { email, role, name } = await request.json();

    // Validate role
    if (!["admin", "support", "developer"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Generate secure token (32 bytes = 64 hex chars)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days to accept

    // Create invite
    const [invite] = await db
      .insert(employeeInvites)
      .values({
        email,
        role,
        token,
        invitedBy: session.user.id,
        expiresAt,
      })
      .returning();

    // Send invite email
    const inviteUrl = `${process.env.NEXTAUTH_URL}/invite/accept?token=${token}`;
    await sendEmployeeInviteEmail({
      email,
      name: name || email.split("@")[0],
      role,
      inviteUrl,
      invitedBy: session.user.name || session.user.email,
    });

    return NextResponse.json({
      success: true,
      message: "Invite sent successfully",
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (error) {
    console.error("Invite error:", error);
    return NextResponse.json(
      { error: "Failed to send invite" },
      { status: 500 }
    );
  }
}
```

**Step 4: Create Accept Invite Page**

```typescript
// app/invite/accept/page.tsx
"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [formData, setFormData] = useState({
    name: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: formData.name,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to accept invite");
      }

      // Redirect to login
      router.push("/login?invited=true");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="text-3xl font-bold text-center">
            Accept Team Invitation
          </h2>
          <p className="mt-2 text-center text-gray-600">
            Set your password to join the team
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={formData.confirmPassword}
              onChange={(e) =>
                setFormData({ ...formData, confirmPassword: e.target.value })
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Setting up account..." : "Accept Invitation"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

**Step 5: Accept Invite API**

```typescript
// app/api/auth/accept-invite/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employeeInvites, users } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { hashPassword } from "@/lib/auth-utils";

export async function POST(request: NextRequest) {
  try {
    const { token, name, password } = await request.json();

    if (!token || !name || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Get invite
    const [invite] = await db
      .select()
      .from(employeeInvites)
      .where(
        and(
          eq(employeeInvites.token, token),
          gt(employeeInvites.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!invite || invite.acceptedAt) {
      return NextResponse.json(
        { error: "Invalid or expired invite" },
        { status: 400 }
      );
    }

    // Create user
    const hashedPassword = await hashPassword(password);
    const [user] = await db
      .insert(users)
      .values({
        email: invite.email,
        name,
        password: hashedPassword,
        role: invite.role,
        emailVerified: new Date(), // Email verified via invite
      })
      .returning();

    // Mark invite as accepted
    await db
      .update(employeeInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(employeeInvites.id, invite.id));

    return NextResponse.json({
      success: true,
      message: "Account created successfully",
    });
  } catch (error) {
    console.error("Accept invite error:", error);
    return NextResponse.json(
      { error: "Failed to accept invite" },
      { status: 500 }
    );
  }
}
```

#### Pros & Cons
✅ Professional UX
✅ Scalable for teams
✅ Secure (employees set own passwords)
✅ Email verified via invite
✅ Audit trail (who invited whom)

❌ More code to implement
❌ More complex to test

## 🎯 Recommendation for You

### Start with Option 1 (Manual Creation)
**Why?**
- You're a startup (likely < 10 employees)
- Simple and works immediately
- No additional development needed
- Full admin control

### Enhance with Password Change Requirement
```typescript
// Add to users table
last_password_change TIMESTAMP WITH TIME ZONE
first_login BOOLEAN DEFAULT TRUE

// Force password change on first login
// Implement password change endpoint
```

### Plan for Option 2 (Invitation System)
**When to implement:**
- Team grows beyond 10 people
- Hiring becomes regular occurrence
- Need to delegate hiring to non-technical managers

## 📋 Implementation Checklist

### Current Setup (Immediate)
- [x] Employees use same `/login` as customers ✅
- [x] Employees created via script ✅
- [x] Email auto-verified for employees ✅

### Enhancements (Recommended)
- [ ] Add password change endpoint
- [ ] Force password change on first login for employees
- [ ] Add `last_password_change` to users table
- [ ] Document secure credential sharing process

### Future (When Scaling)
- [ ] Implement invitation system
- [ ] Add admin UI for sending invites
- [ ] Add invite management dashboard
- [ ] Add invite expiration cleanup

## 🔐 Security Best Practices

### Email Verification
- **Customers**: REQUIRED (public signup)
- **Employees (Manual)**: AUTO-VERIFIED (admin trusted)
- **Employees (Invite)**: VERIFIED via invite link

### Password Management
- **Customers**: Set their own
- **Employees (Manual)**: Admin provides temp password
  - ✅ Force change on first login
  - ✅ Use password manager
  - ❌ Never send via plain text email
- **Employees (Invite)**: Set their own

### Access Control
- **Login**: Same page for all users
- **Signup**: Customers only (employees use invite/script)
- **Admin Functions**: Require admin role

## 📊 Comparison Matrix

| Feature | Manual Creation | Invitation System |
|---------|----------------|-------------------|
| Setup Time | Immediate | 2-3 hours |
| Scalability | 1-10 employees | Unlimited |
| Security | High | Very High |
| UX | Basic | Professional |
| Email Verification | Auto | Via Invite |
| Password Management | Admin provides | Employee sets |
| Audit Trail | Manual | Automatic |
| Best For | Startups | Growing teams |

## Summary

### Current Setup (Good! ✅)
- Login: Both customers and employees use `/login`
- Signup: Customers use `/signup`, employees use script
- Email Verification: Auto-verified for employees (admin trusted)

### Best Practice
**For now**: Continue with manual creation
**Enhance**: Add password change requirement
**Future**: Implement invitation system when team grows

Your current approach is actually industry-standard for early-stage startups!

