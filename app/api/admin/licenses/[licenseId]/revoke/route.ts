import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/auth-helpers";
import { handleApiError, successResponse } from "@/lib/api/response-helpers";
import { db } from "@/lib/db";
import { licenseKeys } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/admin/licenses/[licenseId]/revoke
 * Revoke a license key (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ licenseId: string }> }
) {
  try {
    await requireAdmin();
    const { licenseId } = await params;
    const body = await request.json();
    const { reason } = body;

    if (!reason) {
      return NextResponse.json(
        { error: "Revocation reason is required" },
        { status: 400 }
      );
    }

    // Revoke the license
    const [revokedLicense] = await db
      .update(licenseKeys)
      .set({
        isActive: false,
        revokedAt: new Date(),
        revocationReason: reason,
      })
      .where(eq(licenseKeys.id, licenseId))
      .returning();

    if (!revokedLicense) {
      return NextResponse.json(
        { error: "License key not found" },
        { status: 404 }
      );
    }

    return successResponse({
      success: true,
      message: "License key revoked successfully",
      license: revokedLicense,
    });
  } catch (error) {
    return handleApiError(error, "Failed to revoke license key");
  }
}

