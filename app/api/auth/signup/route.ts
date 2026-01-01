import { NextRequest, NextResponse } from "next/server";
import {
  createUser,
  getUserByEmail,
  generateVerificationToken,
} from "@/lib/auth-utils";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password, and name are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Create user (emailVerified will be null by default)
    const newUser = await createUser(email, password, name);

    // Generate verification token
    const verificationToken = await generateVerificationToken(email);

    // Send verification email
    const emailResult = await sendVerificationEmail(newUser.email, verificationToken);
    
    if (!emailResult.success) {
      console.error("Email sending failed:", emailResult.error);
      
      // In development, always log the verification URL
      if (process.env.NODE_ENV === "development") {
        console.log("═══════════════════════════════════════════════════════");
        console.log("⚠️  EMAIL SENDING FAILED - Verification URL (DEV ONLY):");
        console.log(emailResult.verificationUrl);
        console.log("═══════════════════════════════════════════════════════");
      }
      
      // Return error response so user knows email failed
      return NextResponse.json(
        {
          success: false,
          error: emailResult.error || "Failed to send verification email",
          message: "Account created but verification email failed to send. Please contact support.",
          // Include verification URL in development for testing
          ...(process.env.NODE_ENV === "development" && {
            verificationUrl: emailResult.verificationUrl,
            note: "Check server logs for verification URL",
          }),
        },
        { status: 500 }
      );
    }

    // Log success in development
    if (process.env.NODE_ENV === "development") {
      console.log("✅ Verification email sent successfully to:", newUser.email);
      console.log("📧 Check inbox (and spam folder) for:", newUser.email);
      console.log("✅ Email sent via Gmail SMTP");
    }

    // Return success (DO NOT auto-login - user must verify email first)
    return NextResponse.json({
      success: true,
      message: "Account created successfully. Please check your email to verify your account.",
      email: newUser.email,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

