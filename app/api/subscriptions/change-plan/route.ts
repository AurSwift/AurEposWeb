import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { db } from "@/lib/db";
import { subscriptions, licenseKeys, subscriptionChanges } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getStripePriceId,
  getPlan,
  type PlanId,
  type BillingCycle,
} from "@/lib/stripe/plans";
import { createProrationPayment } from "@/lib/db/payment-helpers";
import { requireAuth } from "@/lib/api/auth-helpers";
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";
import {
  successResponse,
  handleApiError,
  ValidationError,
} from "@/lib/api/response-helpers";
import { isValidPlanId, isUpgrade as checkIsUpgrade } from "@/lib/stripe/plan-utils";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const { subscriptionId, newPlanId, newBillingCycle } =
      (await request.json()) as {
        subscriptionId: string;
        newPlanId: PlanId;
        newBillingCycle?: BillingCycle;
      };

    if (!subscriptionId || !newPlanId) {
      throw new ValidationError("Subscription ID and new plan ID are required");
    }

    // Validate plan ID
    if (!isValidPlanId(newPlanId)) {
      throw new ValidationError("Invalid plan ID");
    }

    const customer = await getCustomerOrThrow(session.user.id);

    // Get current subscription
    const [currentSub] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.id, subscriptionId),
          eq(subscriptions.customerId, customer.id)
        )
      )
      .limit(1);

    if (!currentSub || !currentSub.stripeSubscriptionId) {
      throw new ValidationError("Subscription not found");
    }

    // Determine billing cycle (use existing if not provided)
    const billingCycle =
      newBillingCycle || (currentSub.billingCycle as BillingCycle);

    // Get new plan details
    const newPlan = await getPlan(newPlanId);
    const newPrice =
      billingCycle === "monthly" ? newPlan.priceMonthly : newPlan.priceAnnual;
    const newPriceId = await getStripePriceId(newPlanId, billingCycle);

    // Get current Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(
      currentSub.stripeSubscriptionId
    );

    // Update subscription in Stripe
    const updatedSubscription = await stripe.subscriptions.update(
      currentSub.stripeSubscriptionId,
      {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_behavior: "create_prorations", // Prorate the change
        metadata: {
          ...stripeSubscription.metadata,
          planId: newPlanId,
          billingCycle,
        },
      }
    );

    // Proration is handled automatically by Stripe
    // We just set placeholders for the payment record
    const prorationAmount = 0;
    const currency = "USD";
    const stripePaymentId: string | null = null;
    const invoiceUrl: string | null = null;

    // Determine if this is an upgrade or downgrade
    const isUpgradeChange =
      currentSub.planId && isValidPlanId(currentSub.planId)
        ? checkIsUpgrade(currentSub.planId as PlanId, newPlanId)
        : newPrice > parseFloat(currentSub.price || "0");
    const changeType = isUpgradeChange ? "plan_upgrade" : "plan_downgrade";

    // Update database in a transaction
    await db.transaction(async (tx) => {
      // Update subscription
      await tx
        .update(subscriptions)
        .set({
          planId: newPlanId,
          billingCycle,
          price: newPrice.toString(),
          updatedAt: new Date(),
          metadata: {
            ...(currentSub.metadata || {}),
            stripePriceId: newPriceId,
          },
        })
        .where(eq(subscriptions.id, subscriptionId));

      // Record change
      await tx.insert(subscriptionChanges).values({
        subscriptionId,
        customerId: customer.id,
        changeType,
        previousPlanId: currentSub.planId,
        newPlanId,
        previousBillingCycle: currentSub.billingCycle,
        newBillingCycle: billingCycle,
        previousPrice: currentSub.price,
        newPrice: newPrice.toString(),
        prorationAmount: prorationAmount.toString(),
        effectiveDate: new Date(),
        reason: `Plan changed from ${currentSub.planId} to ${newPlanId}`,
        metadata: {
          changedBy: session.user.id,
          stripeSubscriptionId: currentSub.stripeSubscriptionId,
        },
      });

      // Update license key limits
      await tx
        .update(licenseKeys)
        .set({
          maxTerminals: newPlan.features.maxTerminals,
        })
        .where(eq(licenseKeys.subscriptionId, subscriptionId));

      // Create proration payment record (if applicable and positive)
      // Uses transaction for atomicity
      await createProrationPayment(
        customer.id,
        subscriptionId,
        prorationAmount,
        currency,
        new Date((updatedSubscription as any).current_period_start * 1000),
        new Date((updatedSubscription as any).current_period_end * 1000),
        stripePaymentId,
        invoiceUrl,
        tx
      );
    });

    return successResponse({
      success: true,
      message: `Successfully ${isUpgradeChange ? "upgraded" : "downgraded"} to ${
        newPlan.name
      } plan`,
      subscription: {
        planId: newPlanId,
        billingCycle,
        price: newPrice,
        prorationAmount,
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to change plan");
  }
}
