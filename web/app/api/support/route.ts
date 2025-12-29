import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { customers, supportTickets } from "@/lib/db/schema";
import { eq, desc, and, or, ilike, count, gte } from "drizzle-orm";
import { createTicketSchema } from "@/lib/validations/support-ticket";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get customer
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, session.user.id))
      .limit(1);

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");

    // Build conditions
    const conditions = [eq(supportTickets.customerId, customer.id)];

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
      .select()
      .from(supportTickets)
      .where(and(...conditions))
      .orderBy(desc(supportTickets.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(supportTickets)
      .where(and(...conditions));

    const totalCount = countResult?.count ? Number(countResult.count) : 0;
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        category: ticket.category,
        priority: ticket.priority,
        message: ticket.message,
        status: ticket.status,
        response: ticket.response,
        respondedAt: ticket.respondedAt,
        firstResponseAt: ticket.firstResponseAt,
        resolvedAt: ticket.resolvedAt,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Support tickets fetch error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch support tickets",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get customer
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, session.user.id))
      .limit(1);

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Rate limiting: Check tickets created in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentTickets = await db
      .select({ count: count() })
      .from(supportTickets)
      .where(
        and(
          eq(supportTickets.customerId, customer.id),
          gte(supportTickets.createdAt, oneHourAgo)
        )
      );

    const ticketCount = recentTickets[0]?.count ? Number(recentTickets[0].count) : 0;
    if (ticketCount >= 5) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "You have reached the limit of 5 tickets per hour. Please wait before submitting another ticket.",
        },
        { status: 429 }
      );
    }

    // Validate input
    const body = await request.json();
    const validationResult = createTicketSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { subject, category, priority, message } = validationResult.data;

    // Generate ticket number
    const year = new Date().getFullYear();
    const allTickets = await db
      .select({ ticketNumber: supportTickets.ticketNumber })
      .from(supportTickets)
      .where(ilike(supportTickets.ticketNumber, `TKT-${year}-%`))
      .orderBy(desc(supportTickets.createdAt));

    let ticketNumber: string;
    if (allTickets.length > 0 && allTickets[0]?.ticketNumber) {
      const lastNumber = parseInt(allTickets[0].ticketNumber.split("-")[2] || "0");
      ticketNumber = `TKT-${year}-${String(lastNumber + 1).padStart(6, "0")}`;
    } else {
      ticketNumber = `TKT-${year}-000001`;
    }

    // Create support ticket
    const [ticket] = await db
      .insert(supportTickets)
      .values({
        ticketNumber,
        customerId: customer.id,
        subject,
        category,
        priority,
        message,
        status: "open",
        updatedAt: new Date(),
      })
      .returning();

    // TODO: Send email notification to customer and admins
    // await sendTicketCreatedEmail(customer.email, ticket);
    // await notifyAdmins(ticket);

    return NextResponse.json({
      success: true,
      message: "Support ticket created successfully",
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
    });
  } catch (error) {
    console.error("Support ticket creation error:", error);
    return NextResponse.json(
      {
        error: "Failed to create support ticket",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

