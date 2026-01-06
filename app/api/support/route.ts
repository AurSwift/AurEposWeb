import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { supportTickets } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/api/auth-helpers";
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";
import {
  successResponse,
  handleApiError,
  ValidationError,
} from "@/lib/api/response-helpers";

export async function GET(_request: NextRequest) {
  try {
    const session = await requireAuth();
    const customer = await getCustomerOrThrow(session.user.id);

    // Get all support tickets for this customer
    const tickets = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.customerId, customer.id))
      .orderBy(desc(supportTickets.createdAt));

    return NextResponse.json({
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        subject: ticket.subject,
        category: ticket.category,
        priority: ticket.priority,
        message: ticket.message,
        status: ticket.status,
        response: ticket.response,
        respondedAt: ticket.respondedAt,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      })),
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
    const session = await requireAuth();
    const customer = await getCustomerOrThrow(session.user.id);

    const body = await request.json();
    const { subject, category, priority, message } = body;

    if (!subject || !category || !priority || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create support ticket
    const [ticket] = await db
      .insert(supportTickets)
      .values({
        customerId: customer.id,
        subject,
        category,
        priority,
        message,
        status: "open",
      })
      .returning();

    return successResponse({
      success: true,
      message: "Support ticket created successfully",
      ticket: {
        id: ticket.id,
        subject: ticket.subject,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to create support ticket");
  }
}

