import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, generateVerificationToken } from "@/lib/auth-utils";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Get user to check if exists and not already verified
    const user = await getUserByEmail(email);

    // Don't reveal if user exists or not (security best practice)
    // Return same success message regardless
    if (!user) {
      return NextResponse.json({
        message:
          "If an account exists and is not verified, a verification email has been sent.",
      });
    }

    // If user is already verified, return success message (don't reveal status)
    if (user.emailVerified) {
      return NextResponse.json({
        message:
          "If an account exists and is not verified, a verification email has been sent.",
      });
    }

    // Generate new verification token (this will delete old tokens)
    const verificationToken = await generateVerificationToken(email);

    // Send verification email
    const emailResult = await sendVerificationEmail(email, verificationToken);

    if (!emailResult.success) {
      console.error("Verification email failed:", emailResult.error);

      // In development, log the verification URL
      if (process.env.NODE_ENV === "development") {
        console.log("═══════════════════════════════════════════════════════");
        console.log("⚠️  EMAIL SENDING FAILED - Verification URL (DEV ONLY):");
        console.log(emailResult.verificationUrl);
        console.log("═══════════════════════════════════════════════════════");
      }

      // Still return success message (don't reveal user existence)
      // But log the error for debugging
    } else if (process.env.NODE_ENV === "development") {
      console.log("✅ Verification email sent to:", email);
    }

    return NextResponse.json({
      message:
        "If an account exists and is not verified, a verification email has been sent.",
    });
  } catch (error) {
    console.error("Verification email error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
