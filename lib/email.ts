import nodemailer from "nodemailer";

/**
 * Create Gmail SMTP transporter
 */
function createTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error(
      "GMAIL_USER and GMAIL_APP_PASSWORD environment variables are required"
    );
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD, // Gmail App Password (not regular password)
    },
  });
}

/**
 * Send email verification email using Gmail SMTP
 */
export async function sendVerificationEmail(
  email: string,
  token: string
): Promise<{ success: boolean; error?: string; verificationUrl?: string }> {
  const verificationUrl = `${
    process.env.NEXTAUTH_URL || "http://localhost:3000"
  }/verify-email?token=${token}`;

  const fromEmail = process.env.GMAIL_USER || process.env.GMAIL_FROM_EMAIL;

  if (!fromEmail) {
    return {
      success: false,
      error: "Gmail sender email not configured",
      verificationUrl,
    };
  }

  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"aurswift" <${fromEmail}>`,
      to: email,
      subject: "Verify Your Email - aurswift",
      html: generateVerificationEmailTemplate(verificationUrl),
      text: generateVerificationEmailText(verificationUrl),
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("Verification email sent successfully:", {
      email,
      messageId: info.messageId,
      from: fromEmail,
    });

    return { success: true, verificationUrl };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to send email";
    console.error("Failed to send verification email:", {
      email,
      error: errorMessage,
      errorDetails: error,
    });

    return {
      success: false,
      error: errorMessage,
      verificationUrl, // Return URL for development
    };
  }
}

/**
 * Generate HTML email template for verification email
 */
function generateVerificationEmailTemplate(verificationUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #333; font-size: 32px; font-weight: bold;">aurswift</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #333; font-size: 24px;">Verify Your Email Address</h2>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                Thank you for signing up for aurswift!
              </p>
              <p style="margin: 0 0 30px; color: #666; font-size: 16px; line-height: 1.6;">
                Please verify your email address by clicking the button below to activate your account.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 0 0 30px;">
                    <a href="${verificationUrl}" style="display: inline-block; padding: 14px 28px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Fallback Link -->
              <p style="margin: 0 0 30px; color: #666; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:<br>
                <a href="${verificationUrl}" style="color: #007bff; word-break: break-all; text-decoration: underline;">${verificationUrl}</a>
              </p>
              
              <!-- Expiry Notice -->
              <p style="margin: 0 0 20px; color: #999; font-size: 14px; line-height: 1.6;">
                This verification link will expire in 3 hours.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #999; font-size: 12px; line-height: 1.6; text-align: center;">
                If you didn't create an account with aurswift, please ignore this email.
              </p>
              <p style="margin: 10px 0 0; color: #999; font-size: 12px; line-height: 1.6; text-align: center;">
                This is an automated message, please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generate plain text email for verification
 */
function generateVerificationEmailText(verificationUrl: string): string {
  return `Verify Your Email Address

Thank you for signing up for aurswift!

Please verify your email address by visiting this link:
${verificationUrl}

This verification link will expire in 3 hours.

If you didn't create an account with aurswift, please ignore this email.

This is an automated message, please do not reply to this email.`;
}
