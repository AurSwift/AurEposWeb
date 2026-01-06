import { createTransporter, getFromEmail } from "@/lib/email";

/**
 * Trial Notification System
 * Handles all email notifications related to trial periods and subscription lifecycle
 */

interface TrialNotificationData {
  email: string;
  userName?: string;
  planName: string;
  trialEndDate: Date;
  loginUrl?: string;
  billingUrl?: string;
}

interface CancellationData {
  email: string;
  userName?: string;
  planName: string;
  accessEndDate: Date;
  exportDataUrl?: string;
  wasInTrial: boolean;
}

interface GracePeriodData {
  email: string;
  userName?: string;
  planName: string;
  gracePeriodEndDate: Date;
  daysRemaining: number;
  reactivateUrl?: string;
}

/**
 * Send trial ending in 3 days notification
 */
export async function sendTrialEnding3DaysEmail(
  data: TrialNotificationData
): Promise<{ success: boolean; error?: string }> {
  const fromEmail = process.env.GMAIL_USER || process.env.GMAIL_FROM_EMAIL;

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
      to: data.email,
      subject: "Your AuraSwift Trial Ends in 3 Days",
      html: generateTrialEnding3DaysTemplate(data),
      text: generateTrialEnding3DaysText(data),
    };

    await transporter.sendMail(mailOptions);
    console.log("Trial ending 3-day notification sent:", data.email);

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to send email";
    console.error("Failed to send trial ending 3-day notification:", {
      email: data.email,
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Send trial ending in 1 day notification
 */
export async function sendTrialEnding1DayEmail(
  data: TrialNotificationData
): Promise<{ success: boolean; error?: string }> {
  const fromEmail = process.env.GMAIL_USER || process.env.GMAIL_FROM_EMAIL;

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
      to: data.email,
      subject: "Your AuraSwift Trial Ends Tomorrow",
      html: generateTrialEnding1DayTemplate(data),
      text: generateTrialEnding1DayText(data),
    };

    await transporter.sendMail(mailOptions);
    console.log("Trial ending 1-day notification sent:", data.email);

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to send email";
    console.error("Failed to send trial ending 1-day notification:", {
      email: data.email,
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Send trial ended notification (payment required)
 */
export async function sendTrialEndedEmail(
  data: TrialNotificationData
): Promise<{ success: boolean; error?: string }> {
  const fromEmail = process.env.GMAIL_USER || process.env.GMAIL_FROM_EMAIL;

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
      to: data.email,
      subject: "Your AuraSwift Trial Has Ended - Add Payment Method",
      html: generateTrialEndedTemplate(data),
      text: generateTrialEndedText(data),
    };

    await transporter.sendMail(mailOptions);
    console.log("Trial ended notification sent:", data.email);

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to send email";
    console.error("Failed to send trial ended notification:", {
      email: data.email,
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Send cancellation confirmation email
 */
export async function sendCancellationConfirmationEmail(
  data: CancellationData
): Promise<{ success: boolean; error?: string }> {
  const fromEmail = process.env.GMAIL_USER || process.env.GMAIL_FROM_EMAIL;

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
      to: data.email,
      subject: data.wasInTrial
        ? "Trial Cancellation Confirmed - Access Until Trial End"
        : "Subscription Cancellation Confirmed",
      html: generateCancellationConfirmationTemplate(data),
      text: generateCancellationConfirmationText(data),
    };

    await transporter.sendMail(mailOptions);
    console.log("Cancellation confirmation sent:", data.email);

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to send email";
    console.error("Failed to send cancellation confirmation:", {
      email: data.email,
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Send grace period ending notification
 */
export async function sendGracePeriodEndingEmail(
  data: GracePeriodData
): Promise<{ success: boolean; error?: string }> {
  const fromEmail = process.env.GMAIL_USER || process.env.GMAIL_FROM_EMAIL;

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
      to: data.email,
      subject: `Your AuraSwift Access Ends in ${data.daysRemaining} ${
        data.daysRemaining === 1 ? "Day" : "Days"
      }`,
      html: generateGracePeriodEndingTemplate(data),
      text: generateGracePeriodEndingText(data),
    };

    await transporter.sendMail(mailOptions);
    console.log("Grace period ending notification sent:", data.email);

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to send email";
    console.error("Failed to send grace period ending notification:", {
      email: data.email,
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Send license deactivated notification
 */
export async function sendLicenseDeactivatedEmail(data: {
  email: string;
  userName?: string;
  planName: string;
  reactivateUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  const fromEmail = process.env.GMAIL_USER || process.env.GMAIL_FROM_EMAIL;

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
      to: data.email,
      subject: "Your AuraSwift License Has Been Deactivated",
      html: generateLicenseDeactivatedTemplate(data),
      text: generateLicenseDeactivatedText(data),
    };

    await transporter.sendMail(mailOptions);
    console.log("License deactivated notification sent:", data.email);

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to send email";
    console.error("Failed to send license deactivated notification:", {
      email: data.email,
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// EMAIL TEMPLATES - HTML
// ============================================================================

function generateTrialEnding3DaysTemplate(data: TrialNotificationData): string {
  const billingUrl =
    data.billingUrl || `${process.env.NEXTAUTH_URL}/dashboard/billing`;

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
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #333; font-size: 32px; font-weight: bold;">AuraSwift EPOS</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 0 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #333; font-size: 24px;">Your Trial Ends in 3 Days</h2>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                ${data.userName ? `Hi ${data.userName},` : "Hello,"}
              </p>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                Your <strong>${
                  data.planName
                }</strong> trial will end on <strong>${data.trialEndDate.toLocaleDateString()}</strong>.
              </p>
              <p style="margin: 0 0 30px; color: #666; font-size: 16px; line-height: 1.6;">
                To continue using AuraSwift EPOS without interruption, please add your payment method before your trial expires.
              </p>
              
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 0 0 30px;">
                    <a href="${billingUrl}" style="display: inline-block; padding: 14px 28px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                      Add Payment Method
                    </a>
                  </td>
                </tr>
              </table>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 6px; border-left: 4px solid #007bff;">
                <p style="margin: 0 0 10px; color: #333; font-size: 14px; font-weight: bold;">What happens next?</p>
                <ul style="margin: 0; padding-left: 20px; color: #666; font-size: 14px; line-height: 1.8;">
                  <li>Add payment method → Automatic conversion to paid plan</li>
                  <li>No payment method → Access ends after trial</li>
                  <li>You can export your data anytime before trial ends</li>
                </ul>
              </div>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #999; font-size: 12px; line-height: 1.6; text-align: center;">
                Have questions? Contact our support team.
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

function generateTrialEnding1DayTemplate(data: TrialNotificationData): string {
  const billingUrl =
    data.billingUrl || `${process.env.NEXTAUTH_URL}/dashboard/billing`;

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
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #333; font-size: 32px; font-weight: bold;">AuraSwift EPOS</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 0 40px 30px;">
              <div style="margin: 0 0 20px; padding: 15px; background-color: #fff3cd; border-radius: 6px; border-left: 4px solid #ffc107;">
                <p style="margin: 0; color: #856404; font-size: 16px; font-weight: bold;">⏰ Your trial ends tomorrow!</p>
              </div>
              
              <h2 style="margin: 0 0 20px; color: #333; font-size: 24px;">Last Chance to Add Payment</h2>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                ${data.userName ? `Hi ${data.userName},` : "Hello,"}
              </p>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                Your <strong>${
                  data.planName
                }</strong> trial expires tomorrow on <strong>${data.trialEndDate.toLocaleDateString()}</strong>.
              </p>
              <p style="margin: 0 0 30px; color: #666; font-size: 16px; line-height: 1.6;">
                Add your payment method now to avoid any interruption in service.
              </p>
              
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 0 0 30px;">
                    <a href="${billingUrl}" style="display: inline-block; padding: 14px 28px; background-color: #dc3545; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                      Add Payment Now
                    </a>
                  </td>
                </tr>
              </table>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 6px;">
                <p style="margin: 0 0 10px; color: #333; font-size: 14px; font-weight: bold;">Don't want to continue?</p>
                <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6;">
                  No worries! Your trial will simply expire and no charges will be made. 
                  We recommend exporting your data before the trial ends.
                </p>
              </div>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #999; font-size: 12px; line-height: 1.6; text-align: center;">
                Need help? Contact our support team.
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

function generateTrialEndedTemplate(data: TrialNotificationData): string {
  const billingUrl =
    data.billingUrl || `${process.env.NEXTAUTH_URL}/dashboard/billing`;

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
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #333; font-size: 32px; font-weight: bold;">AuraSwift EPOS</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 0 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #333; font-size: 24px;">Your Trial Has Ended</h2>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                ${data.userName ? `Hi ${data.userName},` : "Hello,"}
              </p>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                Your <strong>${
                  data.planName
                }</strong> trial ended on <strong>${data.trialEndDate.toLocaleDateString()}</strong>.
              </p>
              <p style="margin: 0 0 30px; color: #666; font-size: 16px; line-height: 1.6;">
                To reactivate your account and continue using AuraSwift EPOS, please add your payment method.
              </p>
              
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 0 0 30px;">
                    <a href="${billingUrl}" style="display: inline-block; padding: 14px 28px; background-color: #28a745; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                      Reactivate Your Account
                    </a>
                  </td>
                </tr>
              </table>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #fff3cd; border-radius: 6px; border-left: 4px solid #ffc107;">
                <p style="margin: 0 0 10px; color: #856404; font-size: 14px; font-weight: bold;">⚠️ Your data is safe</p>
                <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.6;">
                  Your account data is retained for 90 days. You can reactivate anytime within this period to restore full access.
                </p>
              </div>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #999; font-size: 12px; line-height: 1.6; text-align: center;">
                Questions about reactivation? Contact our support team.
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

function generateCancellationConfirmationTemplate(
  data: CancellationData
): string {
  const exportUrl =
    data.exportDataUrl || `${process.env.NEXTAUTH_URL}/dashboard/export`;

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
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #333; font-size: 32px; font-weight: bold;">AuraSwift EPOS</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 0 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #333; font-size: 24px;">
                ${
                  data.wasInTrial
                    ? "Trial Cancellation Confirmed"
                    : "Cancellation Confirmed"
                }
              </h2>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                ${data.userName ? `Hi ${data.userName},` : "Hello,"}
              </p>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                Your <strong>${
                  data.planName
                }</strong> subscription has been cancelled.
              </p>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #d1ecf1; border-radius: 6px; border-left: 4px solid #17a2b8;">
                <p style="margin: 0 0 10px; color: #0c5460; font-size: 14px; font-weight: bold;">
                  ${
                    data.wasInTrial
                      ? "ℹ️ You still have access until your trial ends"
                      : "ℹ️ Important Information"
                  }
                </p>
                <p style="margin: 0; color: #0c5460; font-size: 14px; line-height: 1.6;">
                  ${
                    data.wasInTrial
                      ? `You'll retain full access to AuraSwift EPOS until <strong>${data.accessEndDate.toLocaleDateString()}</strong>. No charges will be made.`
                      : `You'll retain access until <strong>${data.accessEndDate.toLocaleDateString()}</strong>. After that, your license will be deactivated.`
                  }
                </p>
              </div>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 6px;">
                <p style="margin: 0 0 15px; color: #333; font-size: 14px; font-weight: bold;">📥 Export Your Data</p>
                <p style="margin: 0 0 15px; color: #666; font-size: 14px; line-height: 1.6;">
                  Before your access ends, we recommend exporting your transaction history, reports, and customer data.
                </p>
                <a href="${exportUrl}" style="display: inline-block; padding: 10px 20px; background-color: #6c757d; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 14px;">
                  Export My Data
                </a>
              </div>
              
              <p style="margin: 30px 0 0; color: #666; font-size: 14px; line-height: 1.6;">
                We're sorry to see you go. If you have feedback or encountered any issues, we'd love to hear from you.
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #999; font-size: 12px; line-height: 1.6; text-align: center;">
                Changed your mind? You can reactivate anytime from your dashboard.
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

function generateGracePeriodEndingTemplate(data: GracePeriodData): string {
  const reactivateUrl =
    data.reactivateUrl || `${process.env.NEXTAUTH_URL}/dashboard/billing`;

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
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #333; font-size: 32px; font-weight: bold;">AuraSwift EPOS</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 0 40px 30px;">
              <div style="margin: 0 0 20px; padding: 15px; background-color: #f8d7da; border-radius: 6px; border-left: 4px solid #dc3545;">
                <p style="margin: 0; color: #721c24; font-size: 16px; font-weight: bold;">
                  ⚠️ Your access ends in ${data.daysRemaining} ${
    data.daysRemaining === 1 ? "day" : "days"
  }
                </p>
              </div>
              
              <h2 style="margin: 0 0 20px; color: #333; font-size: 24px;">Grace Period Ending Soon</h2>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                ${data.userName ? `Hi ${data.userName},` : "Hello,"}
              </p>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                Your AuraSwift EPOS access will end on <strong>${data.gracePeriodEndDate.toLocaleDateString()}</strong>.
              </p>
              <p style="margin: 0 0 30px; color: #666; font-size: 16px; line-height: 1.6;">
                To restore full access, please reactivate your <strong>${
                  data.planName
                }</strong> subscription.
              </p>
              
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 0 0 30px;">
                    <a href="${reactivateUrl}" style="display: inline-block; padding: 14px 28px; background-color: #dc3545; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                      Reactivate Now
                    </a>
                  </td>
                </tr>
              </table>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 6px;">
                <p style="margin: 0 0 10px; color: #333; font-size: 14px; font-weight: bold;">What happens when access ends?</p>
                <ul style="margin: 0; padding-left: 20px; color: #666; font-size: 14px; line-height: 1.8;">
                  <li>Your desktop license will be deactivated</li>
                  <li>You won't be able to process transactions</li>
                  <li>Your data remains safe for 90 days</li>
                  <li>You can reactivate anytime within 90 days</li>
                </ul>
              </div>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #999; font-size: 12px; line-height: 1.6; text-align: center;">
                Need assistance? Contact our support team.
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

function generateLicenseDeactivatedTemplate(data: {
  email: string;
  userName?: string;
  planName: string;
  reactivateUrl?: string;
}): string {
  const reactivateUrl =
    data.reactivateUrl || `${process.env.NEXTAUTH_URL}/dashboard/billing`;

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
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #333; font-size: 32px; font-weight: bold;">AuraSwift EPOS</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 0 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #333; font-size: 24px;">Your License Has Been Deactivated</h2>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                ${data.userName ? `Hi ${data.userName},` : "Hello,"}
              </p>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                Your AuraSwift EPOS license has been deactivated. Your desktop application will no longer have access to process transactions.
              </p>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #d1ecf1; border-radius: 6px; border-left: 4px solid #17a2b8;">
                <p style="margin: 0 0 10px; color: #0c5460; font-size: 14px; font-weight: bold;">💾 Your data is safe</p>
                <p style="margin: 0; color: #0c5460; font-size: 14px; line-height: 1.6;">
                  We retain your account data for 90 days. You can reactivate anytime and pick up right where you left off.
                </p>
              </div>
              
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 30px 0;">
                    <a href="${reactivateUrl}" style="display: inline-block; padding: 14px 28px; background-color: #28a745; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                      Reactivate My Subscription
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6;">
                If you believe this is an error or need assistance, please contact our support team immediately.
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #999; font-size: 12px; line-height: 1.6; text-align: center;">
                Questions? Contact support@auraswift.com
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

// ============================================================================
// EMAIL TEMPLATES - PLAIN TEXT
// ============================================================================

function generateTrialEnding3DaysText(data: TrialNotificationData): string {
  const billingUrl =
    data.billingUrl || `${process.env.NEXTAUTH_URL}/dashboard/billing`;

  return `
AuraSwift EPOS - Your Trial Ends in 3 Days

${data.userName ? `Hi ${data.userName},` : "Hello,"}

Your ${
    data.planName
  } trial will end on ${data.trialEndDate.toLocaleDateString()}.

To continue using AuraSwift EPOS without interruption, please add your payment method before your trial expires.

Add Payment Method: ${billingUrl}

What happens next?
- Add payment method → Automatic conversion to paid plan
- No payment method → Access ends after trial
- You can export your data anytime before trial ends

Have questions? Contact our support team.
`;
}

function generateTrialEnding1DayText(data: TrialNotificationData): string {
  const billingUrl =
    data.billingUrl || `${process.env.NEXTAUTH_URL}/dashboard/billing`;

  return `
AuraSwift EPOS - Your Trial Ends Tomorrow

⏰ LAST CHANCE TO ADD PAYMENT

${data.userName ? `Hi ${data.userName},` : "Hello,"}

Your ${
    data.planName
  } trial expires tomorrow on ${data.trialEndDate.toLocaleDateString()}.

Add your payment method now to avoid any interruption in service.

Add Payment Now: ${billingUrl}

Don't want to continue?
No worries! Your trial will simply expire and no charges will be made. We recommend exporting your data before the trial ends.

Need help? Contact our support team.
`;
}

function generateTrialEndedText(data: TrialNotificationData): string {
  const billingUrl =
    data.billingUrl || `${process.env.NEXTAUTH_URL}/dashboard/billing`;

  return `
AuraSwift EPOS - Your Trial Has Ended

${data.userName ? `Hi ${data.userName},` : "Hello,"}

Your ${data.planName} trial ended on ${data.trialEndDate.toLocaleDateString()}.

To reactivate your account and continue using AuraSwift EPOS, please add your payment method.

Reactivate Your Account: ${billingUrl}

⚠️ YOUR DATA IS SAFE
Your account data is retained for 90 days. You can reactivate anytime within this period to restore full access.

Questions about reactivation? Contact our support team.
`;
}

function generateCancellationConfirmationText(data: CancellationData): string {
  const exportUrl =
    data.exportDataUrl || `${process.env.NEXTAUTH_URL}/dashboard/export`;

  return `
AuraSwift EPOS - ${
    data.wasInTrial ? "Trial Cancellation Confirmed" : "Cancellation Confirmed"
  }

${data.userName ? `Hi ${data.userName},` : "Hello,"}

Your ${data.planName} subscription has been cancelled.

${
  data.wasInTrial
    ? `You still have access until your trial ends on ${data.accessEndDate.toLocaleDateString()}. No charges will be made.`
    : `You'll retain access until ${data.accessEndDate.toLocaleDateString()}. After that, your license will be deactivated.`
}

EXPORT YOUR DATA
Before your access ends, we recommend exporting your transaction history, reports, and customer data.

Export My Data: ${exportUrl}

We're sorry to see you go. If you have feedback or encountered any issues, we'd love to hear from you.

Changed your mind? You can reactivate anytime from your dashboard.
`;
}

function generateGracePeriodEndingText(data: GracePeriodData): string {
  const reactivateUrl =
    data.reactivateUrl || `${process.env.NEXTAUTH_URL}/dashboard/billing`;

  return `
AuraSwift EPOS - Your Access Ends in ${data.daysRemaining} ${
    data.daysRemaining === 1 ? "Day" : "Days"
  }

⚠️ GRACE PERIOD ENDING SOON

${data.userName ? `Hi ${data.userName},` : "Hello,"}

Your AuraSwift EPOS access will end on ${data.gracePeriodEndDate.toLocaleDateString()}.

To restore full access, please reactivate your ${data.planName} subscription.

Reactivate Now: ${reactivateUrl}

What happens when access ends?
- Your desktop license will be deactivated
- You won't be able to process transactions
- Your data remains safe for 90 days
- You can reactivate anytime within 90 days

Need assistance? Contact our support team.
`;
}

function generateLicenseDeactivatedText(data: {
  email: string;
  userName?: string;
  planName: string;
  reactivateUrl?: string;
}): string {
  const reactivateUrl =
    data.reactivateUrl || `${process.env.NEXTAUTH_URL}/dashboard/billing`;

  return `
AuraSwift EPOS - Your License Has Been Deactivated

${data.userName ? `Hi ${data.userName},` : "Hello,"}

Your AuraSwift EPOS license has been deactivated. Your desktop application will no longer have access to process transactions.

💾 YOUR DATA IS SAFE
We retain your account data for 90 days. You can reactivate anytime and pick up right where you left off.

Reactivate My Subscription: ${reactivateUrl}

If you believe this is an error or need assistance, please contact our support team immediately.

Questions? Contact support@auraswift.com
`;
}
