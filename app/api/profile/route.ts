import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/api/auth-helpers";
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";
import { handleApiError, successResponse } from "@/lib/api/response-helpers";

export async function GET() {
  try {
    const session = await requireAuth();
    const customer = await getCustomerOrThrow(session.user.id);

    // Parse billing address if it exists
    const billingAddress = customer.billingAddress as {
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
      phone?: string;
    } | null;

    return successResponse({
      profile: {
        companyName: customer.companyName || "",
        email: customer.email,
        phone: billingAddress?.phone || "",
        address: billingAddress?.address || "",
        city: billingAddress?.city || "",
        state: billingAddress?.state || "",
        zipCode: billingAddress?.zipCode || "",
        country: billingAddress?.country || "",
        taxId: customer.taxId || "",
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch profile");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth();
    const customer = await getCustomerOrThrow(session.user.id);

    const body = await request.json();
    const {
      companyName,
      phone,
      address,
      city,
      state,
      zipCode,
      country,
      taxId,
    } = body;

    // Build billing address object
    const billingAddress = {
      address: address || "",
      city: city || "",
      state: state || "",
      zipCode: zipCode || "",
      country: country || "",
      phone: phone || "",
    };

    // Update customer
    await db
      .update(customers)
      .set({
        companyName: companyName || null,
        billingAddress: billingAddress,
        taxId: taxId || null,
      })
      .where(eq(customers.id, customer.id));

    return successResponse({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    return handleApiError(error, "Failed to update profile");
  }
}
