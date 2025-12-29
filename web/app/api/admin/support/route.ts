import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { customers, supportTickets, users } from "@/lib/db/schema";
import { eq, desc, and, or, ilike, count, gte } from "drizzle-orm";
import { updateTicketSchema } from "@/lib/validations/support-ticket";

// TODO: Implement proper admin role check
// For now, this is a placeholder - you should add role-based access control
function isAdmin(userId: string): boolean {
  // Implement your admin check logic here
  // This could check a role in the users table, or a separate admins table
  return false; // Placeholder
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO: Check if user is admin
    // if (!isAdmin(session.user.id)) {
    //   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");

    // Build conditions
    const conditions: any[] = [];

    if (status) {
      conditions.push(eq(supportTickets.status, status));
    }
    if (category) {
      conditions.push(eq(supportTickets.category, category));
    }
    if (priority) {
      conditions.push(eq(supportTickets.priority, priority));
    }
    if (search) {
      conditions.push(
        or(
          ilike(supportTickets.subject, `%${search}%`),
          ilike(supportTickets.message, `%${search}%`),
          ilike(supportTickets.ticketNumber, `%${search}%`)
        )!
      );
    }

    // Get tickets with pagination
    const tickets = await db
      .select({
        ticket: supportTickets,
        customer: {
          id: customers.id,
          companyName: customers.companyName,
          email: customers.email,
        },
      })
      .from(supportTickets)
      .leftJoin(customers, eq(supportTickets.customerId, customers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(supportTickets.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(supportTickets)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const totalCount = countResult?.count ? Number(countResult.count) : 0;
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      tickets: tickets.map((item) => ({
        id: item.ticket.id,
        ticketNumber: item.ticket.ticketNumber,
        subject: item.ticket.subject,
        category: item.ticket.category,
        priority: item.ticket.priority,
        message: item.ticket.message,
        status: item.ticket.status,
        response: item.ticket.response,
        respondedAt: item.ticket.respondedAt,
        firstResponseAt: item.ticket.firstResponseAt,
        resolvedAt: item.ticket.resolvedAt,
        createdAt: item.ticket.createdAt,
        updatedAt: item.ticket.updatedAt,
        customer: item.customer,
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Admin support tickets fetch error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch support tickets",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO: Check if user is admin
    // if (!isAdmin(session.user.id)) {
    //   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // }

    const body = await request.json();
    const { ticketId, ...updateData } = body;

    if (!ticketId) {
      return NextResponse.json(
        { error: "Ticket ID is required" },
        { status: 400 }
      );
    }

    // Validate input
    const validationResult = updateTicketSchema.safeParse(updateData);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    // Get existing ticket
    const [existingTicket] = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, ticketId))
      .limit(1);

    if (!existingTicket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateFields: any = {
      updatedAt: new Date(),
    };

    if (validationResult.data.status) {
      updateFields.status = validationResult.data.status;
      
      // Track first response time
      if (validationResult.data.status === "in_progress" && !existingTicket.firstResponseAt) {
        updateFields.firstResponseAt = new Date();
      }
      
      // Track resolution time
      if (validationResult.data.status === "resolved" && !existingTicket.resolvedAt) {
        updateFields.resolvedAt = new Date();
      }
    }

    if (validationResult.data.response !== undefined) {
      updateFields.response = validationResult.data.response;
      
      // Set respondedAt if this is the first response
      if (!existingTicket.respondedAt) {
        updateFields.respondedAt = new Date();
        updateFields.firstResponseAt = new Date();
        updateFields.respondedBy = session.user.id;
      }
    }

    if (validationResult.data.priority) {
      updateFields.priority = validationResult.data.priority;
    }

    // Update ticket
    const [updatedTicket] = await db
      .update(supportTickets)
      .set(updateFields)
      .where(eq(supportTickets.id, ticketId))
      .returning();

    // TODO: Send email notification to customer if response was added
    // if (validationResult.data.response) {
    //   await sendTicketResponseEmail(customer.email, updatedTicket);
    // }

    return NextResponse.json({
      success: true,
      message: "Ticket updated successfully",
      ticket: updatedTicket,
    });
  } catch (error) {
    console.error("Admin ticket update error:", error);
    return NextResponse.json(
      {
        error: "Failed to update ticket",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

