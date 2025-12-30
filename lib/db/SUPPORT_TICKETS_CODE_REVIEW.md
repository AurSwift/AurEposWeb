# Support Tickets System - Code Review

## Overview

Comprehensive code review of the support tickets system including database schema, API endpoints, and frontend implementation.

---

## ✅ **Strengths**

### 1. Database Schema

- ✅ Well-structured table with appropriate fields
- ✅ Proper indexes on `customerId`, `status`, and `createdAt` for query performance
- ✅ Foreign key relationship to customers table
- ✅ Timestamps for audit trail (`createdAt`, `updatedAt`, `respondedAt`)
- ✅ Support for admin responses with `respondedBy` tracking

### 2. API Design

- ✅ RESTful endpoints (GET, POST)
- ✅ Proper authentication checks
- ✅ Error handling with try-catch blocks
- ✅ Consistent error response format
- ✅ Input validation for required fields

### 3. Frontend

- ✅ Clean, user-friendly form
- ✅ Proper form validation (required fields)
- ✅ Loading states and error handling
- ✅ Toast notifications for user feedback
- ✅ Large message textarea (300px min-height)

---

## ⚠️ **Issues & Improvements**

### 🔴 **Critical Issues**

#### 1. **Missing Input Validation & Sanitization**

**Location:** `web/app/api/support/route.ts:82-90`

**Problem:**

```typescript
const body = await request.json();
const { subject, category, priority, message } = body;

if (!subject || !category || !priority || !message) {
  return NextResponse.json(
    { error: "Missing required fields" },
    { status: 400 }
  );
}
```

**Issues:**

- No length validation (subject could be 1000+ chars, exceeding varchar(255))
- No sanitization (XSS risk if displayed without escaping)
- No validation for enum values (category, priority, status)
- No trim() on strings (whitespace-only submissions pass)

**Recommendation:**

```typescript
import { z } from "zod";

const createTicketSchema = z.object({
  subject: z.string().min(3).max(255).trim(),
  category: z.enum([
    "technical",
    "billing",
    "license",
    "installation",
    "feature",
    "other",
  ]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  message: z.string().min(10).max(10000).trim(),
});

// In POST handler:
const validationResult = createTicketSchema.safeParse(body);
if (!validationResult.success) {
  return NextResponse.json(
    { error: "Validation failed", details: validationResult.error.errors },
    { status: 400 }
  );
}
const { subject, category, priority, message } = validationResult.data;
```

#### 2. **No Rate Limiting**

**Location:** `web/app/api/support/route.ts:61-127`

**Problem:**

- Users can spam support tickets
- No protection against abuse
- Could fill database with junk tickets

**Recommendation:**

```typescript
// Add rate limiting middleware or check
const ticketCount = await db
  .select({ count: count() })
  .from(supportTickets)
  .where(
    and(
      eq(supportTickets.customerId, customer.id),
      gte(supportTickets.createdAt, new Date(Date.now() - 60 * 60 * 1000)) // Last hour
    )
  );

if (ticketCount[0]?.count >= 5) {
  return NextResponse.json(
    {
      error:
        "Rate limit exceeded. Please wait before submitting another ticket.",
    },
    { status: 429 }
  );
}
```

#### 3. **Missing `updatedAt` Auto-Update**

**Location:** `web/lib/db/schema.ts:313-315`

**Problem:**

```typescript
updatedAt: timestamp("updated_at", { withTimezone: true })
  .defaultNow()
  .notNull(),
```

**Issue:**

- `defaultNow()` only sets on insert, not on update
- `updatedAt` won't change when ticket is updated

**Recommendation:**

- Use database trigger OR
- Manually update `updatedAt` in all UPDATE queries OR
- Use Drizzle's `$onUpdate` hook if available

---

### 🟡 **Medium Priority Issues**

#### 4. **No Ticket Number/Reference ID**

**Location:** Schema and API

**Problem:**

- Tickets only have UUID, not human-readable ticket numbers
- Hard for customers to reference tickets in emails/phone calls

**Recommendation:**

```typescript
ticketNumber: varchar("ticket_number", { length: 20 })
  .notNull()
  .unique(), // e.g., "TKT-2024-001234"
```

Generate on insert:

```typescript
const ticketNumber = `TKT-${new Date().getFullYear()}-${String(
  ticketCount + 1
).padStart(6, "0")}`;
```

#### 5. **No Email Notifications**

**Location:** `web/app/api/support/route.ts:93-103`

**Problem:**

- No notification sent when ticket is created
- No notification to customer when admin responds
- No notification to admins about new tickets

**Recommendation:**

```typescript
// After ticket creation:
await sendEmail({
  to: customer.email,
  subject: `Support Ticket Created: ${ticketNumber}`,
  template: "ticket-created",
  data: { ticketNumber, subject, category, priority },
});

// Notify admins
await notifyAdmins({
  type: "new_ticket",
  ticketId: ticket.id,
  priority: ticket.priority,
});
```

#### 6. **No File Attachments Support**

**Location:** Schema and API

**Problem:**

- Users can't attach screenshots, logs, or files
- Common requirement for technical support

**Recommendation:**

```typescript
// Add to schema:
export const ticketAttachments = pgTable("ticket_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id")
    .references(() => supportTickets.id)
    .notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

#### 7. **No Ticket Status Updates for Customers**

**Location:** API and Frontend

**Problem:**

- Customers can't see ticket status after submission
- No way to view existing tickets
- No way to add follow-up messages

**Recommendation:**

- Add ticket list view on support page
- Add ticket detail view
- Add ability to reply to tickets (create ticket_threads table)

#### 8. **Missing Admin Endpoint**

**Location:** API

**Problem:**

- No way for admins to:
  - View all tickets
  - Filter by status/priority/category
  - Respond to tickets
  - Update ticket status

**Recommendation:**

```typescript
// web/app/api/admin/support/route.ts
export async function GET(request: NextRequest) {
  // Check admin role
  // Return paginated tickets with filters
}

export async function PATCH(request: NextRequest) {
  // Update ticket status, add response
}
```

#### 9. **No Pagination on GET Endpoint**

**Location:** `web/app/api/support/route.ts:28-33`

**Problem:**

```typescript
const tickets = await db
  .select()
  .from(supportTickets)
  .where(eq(supportTickets.customerId, customer.id))
  .orderBy(desc(supportTickets.createdAt));
```

**Issue:**

- Returns ALL tickets, no pagination
- Could be slow for customers with many tickets

**Recommendation:**

```typescript
const { searchParams } = new URL(request.url);
const page = parseInt(searchParams.get("page") || "1");
const limit = parseInt(searchParams.get("limit") || "20");
const offset = (page - 1) * limit;

const tickets = await db
  .select()
  .from(supportTickets)
  .where(eq(supportTickets.customerId, customer.id))
  .orderBy(desc(supportTickets.createdAt))
  .limit(limit)
  .offset(offset);

// Also return total count for pagination
```

#### 10. **No Search/Filter Functionality**

**Location:** API

**Problem:**

- Can't search tickets by subject/message
- Can't filter by status, category, priority

**Recommendation:**

```typescript
const status = searchParams.get("status");
const category = searchParams.get("category");
const priority = searchParams.get("priority");
const search = searchParams.get("search");

const conditions = [eq(supportTickets.customerId, customer.id)];

if (status) conditions.push(eq(supportTickets.status, status));
if (category) conditions.push(eq(supportTickets.category, category));
if (priority) conditions.push(eq(supportTickets.priority, priority));
if (search) {
  conditions.push(
    or(
      ilike(supportTickets.subject, `%${search}%`),
      ilike(supportTickets.message, `%${search}%`)
    )
  );
}
```

---

### 🟢 **Low Priority / Nice-to-Have**

#### 11. **Missing Ticket Threading**

- No way to have conversations/threads
- Each ticket is single message + response

#### 12. **No Ticket Tags/Labels**

- Can't categorize beyond the main category
- No custom tags for organization

#### 13. **No SLA Tracking**

- No tracking of response time
- No SLA violations alerts

#### 14. **No Ticket Analytics**

- No metrics on ticket volume
- No average response time
- No category distribution

#### 15. **Frontend: No Ticket History View**

- Users can't see their submitted tickets
- No way to check status

---

## 📋 **Recommended Action Items**

### Immediate (Critical)

1. ✅ Add input validation with Zod schema
2. ✅ Add rate limiting (5 tickets per hour)
3. ✅ Fix `updatedAt` to auto-update on changes
4. ✅ Add length validation for all text fields

### Short-term (High Priority)

5. ✅ Add ticket number generation
6. ✅ Add email notifications (ticket created, response received)
7. ✅ Add pagination to GET endpoint
8. ✅ Add ticket list view on frontend

### Medium-term

9. ✅ Add file attachments support
10. ✅ Add admin endpoints for ticket management
11. ✅ Add search/filter functionality
12. ✅ Add ticket threading (conversations)

### Long-term

13. ✅ Add SLA tracking
14. ✅ Add analytics dashboard
15. ✅ Add ticket tags/labels

---

## 🔒 **Security Considerations**

1. **Input Sanitization:** All user inputs should be sanitized before storage
2. **XSS Prevention:** Escape all user content when displaying
3. **Rate Limiting:** Prevent ticket spam
4. **Authorization:** Ensure customers can only see their own tickets
5. **File Upload Security:** If adding attachments, validate file types and sizes
6. **SQL Injection:** Using Drizzle ORM helps, but ensure all queries use parameterized queries

---

## 📊 **Performance Considerations**

1. **Indexes:** ✅ Good - already have indexes on customerId, status, createdAt
2. **Pagination:** ⚠️ Missing - add pagination to prevent loading all tickets
3. **Caching:** Consider caching ticket counts for dashboard
4. **Database Queries:** Current queries are efficient, but add pagination

---

## ✅ **Code Quality**

- **Error Handling:** ✅ Good - proper try-catch blocks
- **Type Safety:** ✅ Good - TypeScript types from schema
- **Code Organization:** ✅ Good - clear separation of concerns
- **Documentation:** ⚠️ Missing - add JSDoc comments to API endpoints

---

## 🎯 **Summary**

The support tickets system has a **solid foundation** with good database design and basic CRUD operations. However, it needs **input validation, rate limiting, and better user experience features** to be production-ready.

**Priority fixes:**

1. Input validation (Zod schema)
2. Rate limiting
3. Pagination
4. Email notifications
5. Ticket list view for customers

**Overall Grade: B+** (Good foundation, needs production hardening)
