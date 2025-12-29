import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "./db";
import {
  users,
  passwordResetTokens,
  customers,
  subscriptions,
  licenseKeys,
} from "./db/schema";
import { eq, and, gt } from "drizzle-orm";
import type { User } from "./db/schema";
import { getPlan } from "./stripe/plans";

// Type exports for compatibility
export interface UserSubscription {
  plan: string;
  status: string;
  nextBillingDate: string;
}

export interface UserPaymentMethod {
  lastFour: string;
  expiry: string;
}

// Hash password helper
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Get user by email
export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result[0] || null;
}

// Get user by ID
export async function getUserById(id: string): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] || null;
}

// Create user
export async function createUser(
  email: string,
  password: string,
  name: string
): Promise<User> {
  const hashedPassword = await hashPassword(password);

  // Create user in database
  const [newUser] = await db
    .insert(users)
    .values({
      email,
      password: hashedPassword,
      name,
    })
    .returning();

  // Create customer record linked to user
  // Note: No subscription is created here - user must complete Stripe checkout
  // to create subscription with payment method and start trial
  const [customer] = await db
    .insert(customers)
    .values({
      userId: newUser.id, // Link user to customer (one-to-one)
      email,
      companyName: name,
      status: "active",
    })
    .returning();

  return newUser;
}

// Generate password reset token
export async function generatePasswordResetToken(
  email: string
): Promise<string> {
  // Delete any existing tokens for this email
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.email, email));

  // Generate new token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 3600000); // 1 hour from now

  await db.insert(passwordResetTokens).values({
    email,
    token: resetToken,
    expires,
  });

  return resetToken;
}

// Verify password reset token
export async function verifyPasswordResetToken(
  token: string
): Promise<{ email: string } | null> {
  const result = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.token, token),
        gt(passwordResetTokens.expires, new Date())
      )
    )
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return { email: result[0].email };
}

// Delete password reset token
export async function deletePasswordResetToken(token: string): Promise<void> {
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token));
}

// Update user password
export async function updateUserPassword(
  email: string,
  newPassword: string
): Promise<void> {
  const hashedPassword = await hashPassword(newPassword);
  await db
    .update(users)
    .set({
      password: hashedPassword,
      updatedAt: new Date(),
    })
    .where(eq(users.email, email));
}

// Get full user data with subscription info
export async function getUserData(userId: string): Promise<{
  id: string;
  email: string;
  name: string;
  subscription?: UserSubscription;
  licenseKey?: string;
  paymentMethod?: UserPaymentMethod;
} | null> {
  const user = await getUserById(userId);
  if (!user) {
    return null;
  }

  // Get customer record using userId relationship (one-to-one)
  const customerResult = await db
    .select()
    .from(customers)
    .where(eq(customers.userId, userId))
    .limit(1);

  if (customerResult.length === 0) {
    return {
      id: user.id,
      email: user.email,
      name: user.name || "",
    };
  }

  const customer = customerResult[0];

  // Get subscription
  const subscriptionResult = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.customerId, customer.id))
    .orderBy(subscriptions.currentPeriodEnd)
    .limit(1);

  let subscription: UserSubscription | undefined;
  if (subscriptionResult.length > 0) {
    const sub = subscriptionResult[0];
    subscription = {
      plan:
        sub.planType === "basic"
          ? "Basic Plan"
          : sub.planType === "professional"
          ? "Pro Plan"
          : "Enterprise Plan",
      status: sub.status || "Inactive",
      nextBillingDate:
        sub.currentPeriodEnd?.toISOString().split("T")[0] ||
        new Date().toISOString().split("T")[0],
    };
  }

  // Get license key
  const licenseKeyResult = await db
    .select()
    .from(licenseKeys)
    .where(eq(licenseKeys.customerId, customer.id))
    .limit(1);

  const licenseKey = licenseKeyResult[0]?.licenseKey;

  // Payment method would come from a payment provider like Stripe
  // For now, return undefined
  const paymentMethod: UserPaymentMethod | undefined = undefined;

  return {
    id: user.id,
    email: user.email,
    name: user.name || customer.companyName || "",
    subscription,
    licenseKey,
    paymentMethod,
  };
}
