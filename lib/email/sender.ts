import { createTransporter, getFromEmail } from "../email";
import type { Transporter } from "nodemailer";

/**
 * Email sending utilities
 * Provides standardized email sending functionality
 */

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

/**
 * Send an email using the configured transporter
 * Handles all common email sending patterns
 * 
 * @param options - Email configuration
 * @returns Result object with success status
 * 
 * @example
 * const result = await sendEmail({
 *   to: "user@example.com",
 *   subject: "Welcome!",
 *   html: "<p>Hello!</p>",
 *   text: "Hello!"
 * });
 */
export async function sendEmail(options: EmailOptions): Promise<SendEmailResult> {
  const fromEmail = getFromEmail();

  if (!fromEmail) {
    return {
      success: false,
      error: "Gmail sender email not configured",
    };
  }

  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"AuraSwift EPOS" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent successfully:", {
      to: options.to,
      subject: options.subject,
      messageId: info.messageId,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to send email";
    
    console.error("Failed to send email:", {
      to: options.to,
      subject: options.subject,
      error: errorMessage,
      errorDetails: error,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Basic HTML stripping for plain text fallback
 * @param html - HTML string
 * @returns Plain text version
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

