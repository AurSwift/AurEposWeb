import { NextRequest, NextResponse } from "next/server";
import {
  verifyVerificationToken,
  deleteVerificationToken,
  verifyUserEmail,
  getUserByEmail,
} from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Verification token is required" },
        { status: 400 }
      );
    }

    // Verify token (check exists and not expired)
    const tokenData = await verifyVerificationToken(token);

    if (!tokenData) {
      return NextResponse.json(
        { error: "Invalid or expired verification token" },
        { status: 400 }
      );
    }

    const { email } = tokenData;

    // Get user to check if already verified
    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if email is already verified
    if (user.emailVerified) {
      // Delete token anyway
      await deleteVerificationToken(token);
      return NextResponse.json({
        success: true,
        message: "Email already verified",
        email,
        alreadyVerified: true,
      });
    }

    // Verify user email (set emailVerified timestamp)
    await verifyUserEmail(email);

    // Delete verification token (single-use)
    await deleteVerificationToken(token);

    return NextResponse.json({
      success: true,
      message: "Email verified successfully",
      email,
      userId: user.id,
    });
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

