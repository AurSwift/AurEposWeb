import { NextRequest, NextResponse } from "next/server";
import { generatePasswordResetToken } from "@/lib/auth-utils";
import { getUserByEmail } from "@/lib/auth-utils";
import { createTransporter, getFromEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await getUserByEmail(email);

    // Don't reveal if user exists or not (security best practice)
    if (!user) {
      // Still return success to prevent email enumeration
      return NextResponse.json({
        message: "If an account exists, a password reset link has been sent.",
      });
    }

    const resetToken = await generatePasswordResetToken(email);
    const resetUrl = `${
      process.env.NEXTAUTH_URL || "http://localhost:3000"
    }/reset-password?token=${resetToken}`;

    // Send email using Gmail SMTP
    try {
      const transporter = createTransporter();
      const fromEmail = process.env.GMAIL_USER || process.env.GMAIL_FROM_EMAIL;

      await transporter.sendMail({
        from: `"aurswift" <${fromEmail}>`,
        to: email,
        subject: "Reset Your Password - aurswift",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Reset Your Password</h2>
            <p>You requested to reset your password for your aurswift account.</p>
            <p>Click the button below to reset your password:</p>
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
              Reset Password
            </a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      // In development, log the reset URL
      if (process.env.NODE_ENV === "development") {
        console.log("Reset URL (dev only):", resetUrl);
      }
    }

    return NextResponse.json({
      message: "If an account exists, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
