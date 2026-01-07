# Admin Interface Documentation

## Overview

A comprehensive admin interface for managing customers, subscriptions, licenses, and support tickets with real-time data from the connected database.

## Features

### 🎨 Reusable DataTable Component

Located at: `components/admin/data-table.tsx`

A fully-featured, reusable table component with:

- **Search**: Real-time search across multiple columns
- **Filtering**: Dropdown filters for status, priority, and other categorical data
- **Pagination**: Navigate through large datasets with configurable page sizes
- **Responsive**: Mobile-friendly design with shadcn UI
- **Type-safe**: Full TypeScript support with generic types

#### Architecture

The admin interface follows a **client-server component pattern**:

1. **Server Components** (pages) - Fetch data from the database
2. **Client Components** (table wrappers) - Handle interactivity (search, filter, pagination)
3. **DataTable Component** - Generic reusable table with UI logic

This separation ensures:
- ✅ Data fetching happens server-side (fast, secure)
- ✅ Interactivity works client-side (instant feedback)
- ✅ No serialization errors with functions
- ✅ Optimal bundle size

#### Usage Example

Create a client component wrapper:

```tsx
// components/admin/my-table.tsx
"use client";

import { DataTable, ColumnDef } from "@/components/admin/data-table";

export function MyTable({ data }: { data: YourDataType[] }) {
  const columns: ColumnDef<YourDataType>[] = [
    {
      header: "Name",
      accessorKey: "name",
      cell: (row) => <span>{row.name}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search..."
      searchKeys={["name", "email"]}
      pageSize={10}
    />
  );
}
```

Then use it in a server component:

```tsx
// app/admin/my-page/page.tsx
import { db } from "@/lib/db";
import { MyTable } from "@/components/admin/my-table";

export default async function MyPage() {
  const data = await db.query.myTable.findMany();
  return <MyTable data={data} />;
}
```

## Admin Pages

### 1. Dashboard (`/admin`)
- Overview statistics
- Quick metrics for customers, subscriptions, licenses, and support tickets
- Visual cards with real-time counts

### 2. Customers (`/admin/customers`)
**Features:**
- List all customers with company name, email, and status
- Search by email, company name, or user name
- Filter by customer status (Active, Suspended, Cancelled)
- View active subscription counts
- Email verification status indicators
- Pagination with 10 customers per page

**Data Displayed:**
- Company/Name with verification badge
- Email address
- Status badge (color-coded)
- Active subscriptions count
- Account creation date
- Quick view action

### 3. Subscriptions (`/admin/subscriptions`) ⭐ NEW
**Features:**
- List all subscriptions across customers
- Search by customer, plan name, or email
- Filter by status (Active, Trialing, Past Due, Cancelled, Paused)
- Filter by billing cycle (Monthly, Annual)
- Shows trial information when applicable
- Cancellation indicators

**Data Displayed:**
- Customer details (company & email)
- Plan type with billing cycle
- Status badges (multiple if canceling)
- Subscription price
- Current period or trial end date
- Creation date
- Link to customer details

### 4. Licenses (`/admin/licenses`)
**Features:**
- List all license keys issued
- Search by license key, customer email, or company
- Filter by license status (Active, Inactive, Revoked)
- Filter by subscription status
- Activation tracking

**Data Displayed:**
- License key (monospaced font)
- Customer details
- License status badge
- Activation count vs. max terminals
- Subscription status
- Issue date

### 5. Support Tickets (`/admin/support`)
**Features:**
- List all support tickets
- Search by subject, customer, or message content
- Filter by category (Technical, Billing, License, etc.)
- Filter by priority (Urgent, High, Medium, Low)
- Filter by status (Open, In Progress, Resolved, Closed)
- Priority-based color coding

**Data Displayed:**
- Subject line
- Customer details
- Category
- Priority badge
- Status badge
- Creation date
- Quick view action

## Navigation

The admin navigation bar includes:
- Dashboard
- Customers
- Subscriptions ⭐ NEW
- Licenses
- Support

All navigation items are accessible from the top bar in the admin layout.

## Database Integration

All pages fetch real data from:
- **customers** table
- **subscriptions** table
- **licenseKeys** table
- **supportTickets** table
- **users** table (for verification status)

Data is fetched server-side using Drizzle ORM with proper joins and aggregations.

## Styling

- **UI Library**: shadcn/ui components
- **Styling**: Tailwind CSS with dark mode support
- **Icons**: lucide-react
- **Typography**: System fonts with proper hierarchy

## Color Coding

### Status Badges
- **Green**: Active, Resolved
- **Blue**: Open, Trialing
- **Yellow**: In Progress, Medium Priority, Past Due, Suspended
- **Orange**: High Priority, Paused
- **Red**: Urgent, Cancelled, Revoked
- **Gray**: Inactive, Closed

## Performance

- Server-side data fetching (React Server Components)
- Client-side search and filtering (instant results)
- Efficient pagination (configurable page size)
- Optimized database queries with proper indexing

## Type Safety

All components are fully typed with TypeScript:
- Generic `DataTable<T>` component
- Typed column definitions
- Type-safe database queries with Drizzle ORM

## Responsive Design

- Mobile-friendly tables with horizontal scroll
- Adaptive layouts for different screen sizes
- Touch-friendly pagination controls
- Collapsible filters on mobile

## Future Enhancements

Consider adding:
- Export to CSV functionality
- Bulk actions (select multiple rows)
- Advanced sorting (multi-column)
- Date range filters
- Real-time updates with WebSockets
- Row expansion for detailed views
- Keyboard navigation
- Column visibility toggles

## Table Wrapper Components

To avoid Next.js serialization errors when passing functions from server to client components, we use dedicated client component wrappers for each table:

- `components/admin/customers-table.tsx` - Customers table with column definitions
- `components/admin/licenses-table.tsx` - License keys table with column definitions
- `components/admin/subscriptions-table.tsx` - Subscriptions table with column definitions
- `components/admin/support-table.tsx` - Support tickets table with column definitions

Each wrapper:
- Is marked with `"use client"`
- Defines column configurations (including cell renderers)
- Receives only serializable data as props
- Passes configurations to the base DataTable component

## Component Props

### DataTable Props

```typescript
type DataTableProps<T> = {
  columns: ColumnDef<T>[];           // Column definitions
  data: T[];                          // Data array
  searchPlaceholder?: string;         // Search input placeholder
  searchKeys?: (keyof T)[];          // Keys to search in
  pageSize?: number;                  // Items per page (default: 10)
  emptyMessage?: string;              // Empty state message
};
```

### ColumnDef Props

```typescript
type ColumnDef<T> = {
  header: string;                     // Column header text
  accessorKey?: keyof T;              // Data key to access
  cell?: (row: T) => React.ReactNode; // Custom cell renderer
  searchable?: boolean;               // Enable search for this column
  filterable?: boolean;               // Show filter dropdown
  filterOptions?: Array<{             // Filter options
    label: string;
    value: string;
  }>;
};
```

## Testing

To test the admin interface:

1. Ensure you have admin/support/developer role
2. Navigate to `/admin`
3. Test each section's search functionality
4. Try different filter combinations
5. Navigate through pages
6. Verify data matches database

## Troubleshooting

**No data showing?**
- Check database connection
- Verify data exists in tables
- Check browser console for errors

**Search not working?**
- Ensure searchKeys are provided
- Verify column keys match data structure

**Filters not appearing?**
- Check filterable: true in column definition
- Verify filterOptions are provided

