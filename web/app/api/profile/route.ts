import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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

    // Parse billing address if it exists
    const billingAddress = customer.billingAddress as
      | {
          address?: string;
          city?: string;
          state?: string;
          zipCode?: string;
          country?: string;
          phone?: string;
        }
      | null;

    return NextResponse.json({
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
    console.error("Profile fetch error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch profile",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      {
        error: "Failed to update profile",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

