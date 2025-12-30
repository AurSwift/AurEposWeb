import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { customers, subscriptions, licenseKeys, activations } from "@/lib/db/schema";
import { eq, and, or, desc } from "drizzle-orm";

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

    // Get active subscription
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.customerId, customer.id),
          or(
            eq(subscriptions.status, "active"),
            eq(subscriptions.status, "trialing")
          )
        )
      )
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    if (!subscription) {
      return NextResponse.json({
        activations: [],
        licenseKeyInfo: null,
      });
    }

    // Get license key for this subscription
    const [licenseKey] = await db
      .select()
      .from(licenseKeys)
      .where(
        and(
          eq(licenseKeys.subscriptionId, subscription.id),
          eq(licenseKeys.isActive, true)
        )
      )
      .limit(1);

    if (!licenseKey) {
      return NextResponse.json({
        activations: [],
        licenseKeyInfo: null,
      });
    }

    // Get all activations for this license key
    const terminalActivations = await db
      .select()
      .from(activations)
      .where(eq(activations.licenseKey, licenseKey.licenseKey))
      .orderBy(desc(activations.firstActivation));

    // Count active activations
    const activeCount = terminalActivations.filter((a) => a.isActive).length;

    return NextResponse.json({
      activations: terminalActivations.map((activation) => ({
        id: activation.id,
        licenseKey: activation.licenseKey,
        terminalName: activation.terminalName,
        machineIdHash: activation.machineIdHash,
        firstActivation: activation.firstActivation,
        lastHeartbeat: activation.lastHeartbeat,
        isActive: activation.isActive,
        ipAddress: activation.ipAddress,
        location: activation.location as {
          city?: string;
          country?: string;
        } | null,
      })),
      licenseKeyInfo: {
        licenseKey: licenseKey.licenseKey,
        maxTerminals: licenseKey.maxTerminals,
        activationCount: activeCount,
      },
    });
  } catch (error) {
    console.error("Terminals fetch error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch terminals",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

