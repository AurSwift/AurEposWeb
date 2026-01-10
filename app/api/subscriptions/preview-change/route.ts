import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getStripePriceId,
  getPlan,
  type PlanId,
  type BillingCycle,
} from "@/lib/stripe/plans";
import { requireAuth } from "@/lib/api/auth-helpers";
import { getCustomerOrThrow } from "@/lib/db/customer-helpers";
import {
  successResponse,
  handleApiError,
  ValidationError,
} from "@/lib/api/response-helpers";
import { isValidPlanId, isUpgrade as checkIsUpgrade } from "@/lib/stripe/plan-utils";

/**
 * Preview the impact of a subscription plan change before committing
 * Shows proration amount, effective date, and billing details
 */
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
    const currentPlan = currentSub.planId ? await getPlan(currentSub.planId as PlanId) : null;
    const newPrice =
      billingCycle === "monthly" ? newPlan.priceMonthly : newPlan.priceAnnual;
    const newPriceId = await getStripePriceId(newPlanId, billingCycle);
    const currentPrice = parseFloat(currentSub.price || "0");

    // Determine if this is an upgrade or downgrade
    const isUpgradeChange =
      currentSub.planId && isValidPlanId(currentSub.planId)
        ? checkIsUpgrade(currentSub.planId as PlanId, newPlanId)
        : newPrice > currentPrice;

    // Preview the proration by retrieving upcoming invoice
    let prorationAmount = 0;
    let immediateCharge = 0;
    let creditApplied = 0;
    let currency = "USD";
    let nextInvoiceDate: Date | null = null;
    let nextInvoiceAmount = 0;

    try {
      // Get current subscription from Stripe
      const stripeSubscription = await stripe.subscriptions.retrieve(
        currentSub.stripeSubscriptionId
      );

      // Preview the invoice with the subscription item change
      const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
        customer: currentSub.stripeCustomerId!,
        subscription: currentSub.stripeSubscriptionId,
        subscription_items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        subscription_proration_behavior: "create_prorations",
      });

      // Calculate proration details
      const prorationLines = upcomingInvoice.lines.data.filter(
        (line) => line.proration
      );

      const prorationAmountCents = prorationLines.reduce(
        (sum, line) => sum + line.amount,
        0
      );

      prorationAmount = prorationAmountCents / 100;
      currency = upcomingInvoice.currency.toUpperCase();
      nextInvoiceDate = new Date(upcomingInvoice.period_end * 1000);
      nextInvoiceAmount = upcomingInvoice.total / 100;

      // Determine immediate charge vs credit
      if (prorationAmount > 0) {
        immediateCharge = prorationAmount;
      } else if (prorationAmount < 0) {
        creditApplied = Math.abs(prorationAmount);
      }
    } catch (previewError) {
      console.error("Could not preview proration:", previewError);
      // Provide an estimate based on simple calculation
      const daysInPeriod = currentSub.currentPeriodEnd && currentSub.currentPeriodStart
        ? Math.ceil(
            (new Date(currentSub.currentPeriodEnd).getTime() -
              new Date(currentSub.currentPeriodStart).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 30;
      
      const daysRemaining = currentSub.currentPeriodEnd
        ? Math.max(
            0,
            Math.ceil(
              (new Date(currentSub.currentPeriodEnd).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24)
            )
          )
        : 0;

      const unusedAmount = (currentPrice / daysInPeriod) * daysRemaining;
      const newPeriodCharge = (newPrice / daysInPeriod) * daysRemaining;
      prorationAmount = newPeriodCharge - unusedAmount;

      if (prorationAmount > 0) {
        immediateCharge = prorationAmount;
      } else if (prorationAmount < 0) {
        creditApplied = Math.abs(prorationAmount);
      }

      nextInvoiceDate = currentSub.currentPeriodEnd || null;
      nextInvoiceAmount = newPrice;
    }

    // Calculate period information
    const periodStart = currentSub.currentPeriodStart
      ? new Date(currentSub.currentPeriodStart)
      : new Date();
    const periodEnd = currentSub.currentPeriodEnd
      ? new Date(currentSub.currentPeriodEnd)
      : new Date();

    return successResponse({
      preview: {
        changeType: isUpgradeChange ? "upgrade" : "downgrade",
        currentPlan: {
          id: currentSub.planId,
          name: currentPlan?.name || currentSub.planId,
          price: currentPrice,
          billingCycle: currentSub.billingCycle,
        },
        newPlan: {
          id: newPlanId,
          name: newPlan.name,
          price: newPrice,
          billingCycle,
          maxTerminals: newPlan.features.maxTerminals,
        },
        proration: {
          amount: prorationAmount,
          immediateCharge,
          creditApplied,
          currency,
          description: isUpgradeChange
            ? `You will be charged ${currency} ${immediateCharge.toFixed(2)} for the remaining ${
                Math.ceil((periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              } days of this billing period.`
            : creditApplied > 0
            ? `A credit of ${currency} ${creditApplied.toFixed(2)} will be applied to your next invoice.`
            : "No proration charge or credit.",
        },
        nextBilling: {
          date: nextInvoiceDate,
          amount: nextInvoiceAmount,
          currency,
        },
        effectiveDate: new Date(),
        currentPeriod: {
          start: periodStart,
          end: periodEnd,
        },
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to preview plan change");
  }
}
