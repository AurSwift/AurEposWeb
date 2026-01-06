import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  users,
  customers,
  subscriptions,
  licenseKeys,
  activations,
  subscriptionChanges,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/api/auth-helpers";
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";
import { successResponse, handleApiError } from "@/lib/api/response-helpers";

/**
 * Data Export API - GDPR Article 20 Compliance (Right to Data Portability)
 *
 * Allows authenticated users to export all their personal data and
 * account information in JSON format.
 *
 * Exported Data Includes:
 * - User account information
 * - Customer details
 * - Subscription history
 * - License keys
 * - Activation records
 * - Subscription change history
 *
 * Security:
 * - Requires authentication
 * - Only exports data for the authenticated user
 * - No admin privileges required
 */

interface ExportedData {
  exportDate: string;
  user: {
    id: string;
    email: string | null;
    name: string | null;
    createdAt: Date | null;
    emailVerified: Date | null;
  };
  customer: {
    id: string;
    companyName: string | null;
    email: string;
    billingAddress: unknown;
    taxId: string | null;
    stripeCustomerId: string | null;
    createdAt: Date | null;
    status: string | null;
  } | null;
  subscriptions: Array<{
    id: string;
    planType: string | null;
    billingCycle: string | null;
    price: string | null;
    status: string | null;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    trialStart: Date | null;
    trialEnd: Date | null;
    canceledAt: Date | null;
    cancelAtPeriodEnd: boolean | null;
    createdAt: Date | null;
  }>;
  licenseKeys: Array<{
    id: string;
    licenseKey: string;
    maxTerminals: number | null;
    activationCount: number | null;
    isActive: boolean | null;
    issuedAt: Date | null;
    expiresAt: Date | null;
    revokedAt: Date | null;
    revocationReason: string | null;
    createdAt: Date | null;
  }>;
  activations: Array<{
    id: string;
    terminalName: string | null;
    machineIdHash: string | null;
    ipAddress: unknown;
    firstActivation: Date | null;
    lastHeartbeat: Date | null;
    isActive: boolean | null;
  }>;
  subscriptionHistory: Array<{
    id: string;
    changeType: string | null;
    previousPlanId: string | null;
    newPlanId: string | null;
    reason: string | null;
    effectiveDate: Date | null;
    createdAt: Date | null;
  }>;
}

export async function GET(_request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    console.log(`[DATA EXPORT] Starting export for user: ${userId}`);

    // ========================================================================
    // 1. Get User Information
    // ========================================================================
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error("User not found");
    }

    // ========================================================================
    // 2. Get Customer Information
    // ========================================================================
    const [customer] = await db
      .select({
        id: customers.id,
        companyName: customers.companyName,
        email: customers.email,
        billingAddress: customers.billingAddress,
        taxId: customers.taxId,
        stripeCustomerId: customers.stripeCustomerId,
        createdAt: customers.createdAt,
        status: customers.status,
      })
      .from(customers)
      .where(eq(customers.userId, userId))
      .limit(1);

    // ========================================================================
    // 3. Get Subscription Information
    // ========================================================================
    const userSubscriptions = customer
      ? await db
          .select({
            id: subscriptions.id,
            planType: subscriptions.planType,
            billingCycle: subscriptions.billingCycle,
            price: subscriptions.price,
            status: subscriptions.status,
            currentPeriodStart: subscriptions.currentPeriodStart,
            currentPeriodEnd: subscriptions.currentPeriodEnd,
            trialStart: subscriptions.trialStart,
            trialEnd: subscriptions.trialEnd,
            canceledAt: subscriptions.canceledAt,
            cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
            createdAt: subscriptions.createdAt,
          })
          .from(subscriptions)
          .where(eq(subscriptions.customerId, customer.id))
      : [];

    // ========================================================================
    // 4. Get License Keys
    // ========================================================================
    const userLicenseKeys = customer
      ? await db
          .select({
            id: licenseKeys.id,
            licenseKey: licenseKeys.licenseKey,
            maxTerminals: licenseKeys.maxTerminals,
            activationCount: licenseKeys.activationCount,
            isActive: licenseKeys.isActive,
            issuedAt: licenseKeys.issuedAt,
            expiresAt: licenseKeys.expiresAt,
            revokedAt: licenseKeys.revokedAt,
            revocationReason: licenseKeys.revocationReason,
            createdAt: licenseKeys.createdAt,
          })
          .from(licenseKeys)
          .where(eq(licenseKeys.customerId, customer.id))
      : [];

    // ========================================================================
    // 5. Get Activation Records
    // ========================================================================
    const allActivations: Array<{
      id: string;
      terminalName: string | null;
      machineIdHash: string | null;
      ipAddress: unknown;
      firstActivation: Date | null;
      lastHeartbeat: Date | null;
      isActive: boolean | null;
    }> = [];

    for (const keyId of userLicenseKeys.map((k) => k.licenseKey)) {
      const keyActivations = await db
        .select({
          id: activations.id,
          terminalName: activations.terminalName,
          machineIdHash: activations.machineIdHash,
          ipAddress: activations.ipAddress,
          firstActivation: activations.firstActivation,
          lastHeartbeat: activations.lastHeartbeat,
          isActive: activations.isActive,
        })
        .from(activations)
        .where(eq(activations.licenseKey, keyId));

      allActivations.push(...keyActivations);
    }

    // ========================================================================
    // 6. Get Subscription Change History
    // ========================================================================
    const subscriptionIds = userSubscriptions.map((sub) => sub.id);
    const changeHistory: Array<{
      id: string;
      changeType: string | null;
      previousPlanId: string | null;
      newPlanId: string | null;
      reason: string | null;
      effectiveDate: Date | null;
      createdAt: Date | null;
    }> = [];

    for (const subId of subscriptionIds) {
      const changes = await db
        .select({
          id: subscriptionChanges.id,
          changeType: subscriptionChanges.changeType,
          previousPlanId: subscriptionChanges.previousPlanId,
          newPlanId: subscriptionChanges.newPlanId,
          reason: subscriptionChanges.reason,
          effectiveDate: subscriptionChanges.effectiveDate,
          createdAt: subscriptionChanges.createdAt,
        })
        .from(subscriptionChanges)
        .where(eq(subscriptionChanges.subscriptionId, subId));

      changeHistory.push(...changes);
    }

    // ========================================================================
    // 7. Compile Export Data
    // ========================================================================
    const exportData: ExportedData = {
      exportDate: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        emailVerified: user.emailVerified,
      },
      customer: customer || null,
      subscriptions: userSubscriptions,
      licenseKeys: userLicenseKeys,
      activations: allActivations,
      subscriptionHistory: changeHistory.sort(
        (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
      ),
    };

    console.log(
      `[DATA EXPORT] Export completed for user: ${userId} (${userSubscriptions.length} subscriptions, ${userLicenseKeys.length} licenses)`
    );

    // ========================================================================
    // 8. Return Data
    // ========================================================================
    // Check if user wants to download as file
    const format = _request.nextUrl.searchParams.get("format");

    if (format === "file") {
      // Return as downloadable JSON file
      const fileName = `auraswift-data-export-${user.id}-${
        new Date().toISOString().split("T")[0]
      }.json`;

      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    }

    // Return as JSON response
    return NextResponse.json({
      success: true,
      message: "Data export completed successfully",
      data: exportData,
    });
  } catch (error) {
    return handleApiError(error, "Failed to export data");
  }
}

/**
 * POST endpoint for requesting data export (same as GET but follows REST conventions)
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
