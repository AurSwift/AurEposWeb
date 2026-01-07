import { NextRequest, NextResponse } from "next/server";
import { requireInternalUser } from "@/lib/api/auth-helpers";
import { handleApiError, successResponse } from "@/lib/api/response-helpers";
import { db } from "@/lib/db";
import { supportTickets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/admin/support/[ticketId]/respond
 * Respond to a support ticket (internal users only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const session = await requireInternalUser();
    const { ticketId } = await params;
    const body = await request.json();
    const { response, status } = body;

    if (!response) {
      return NextResponse.json(
        { error: "Response text is required" },
        { status: 400 }
      );
    }

    // Update support ticket with response
    const [updatedTicket] = await db
      .update(supportTickets)
      .set({
        response,
        respondedAt: new Date(),
        respondedBy: session.user.id, // Now properly references users table
        status: status || "in_progress",
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, ticketId))
      .returning();

    if (!updatedTicket) {
      return NextResponse.json(
        { error: "Support ticket not found" },
        { status: 404 }
      );
    }

    return successResponse({
      success: true,
      message: "Response added successfully",
      ticket: updatedTicket,
    });
  } catch (error) {
    return handleApiError(error, "Failed to respond to support ticket");
  }
}

/**
 * PATCH /api/admin/support/[ticketId]/respond
 * Update ticket status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    await requireInternalUser();
    const { ticketId } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    const [updatedTicket] = await db
      .update(supportTickets)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, ticketId))
      .returning();

    if (!updatedTicket) {
      return NextResponse.json(
        { error: "Support ticket not found" },
        { status: 404 }
      );
    }

    return successResponse({
      success: true,
      message: "Ticket status updated",
      ticket: updatedTicket,
    });
  } catch (error) {
    return handleApiError(error, "Failed to update ticket status");
  }
}

