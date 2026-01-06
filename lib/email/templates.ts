/**
 * Email template composition utilities
 * Provides reusable HTML structure for all email templates
 */

/**
 * Email header HTML (common across all emails)
 */
function emailHeader(): string {
  return `
  <tr>
    <td style="padding: 40px 40px 20px; text-align: center;">
      <h1 style="margin: 0; color: #333; font-size: 32px; font-weight: bold;">AuraSwift EPOS</h1>
    </td>
  </tr>
  `;
}

/**
 * Email footer HTML (common across all emails)
 */
function emailFooter(): string {
  return `
  <tr>
    <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
      <p style="margin: 0; color: #999; font-size: 12px; line-height: 1.6; text-align: center;">
        This is an automated message, please do not reply to this email.
      </p>
      <p style="margin: 10px 0 0; color: #999; font-size: 12px; line-height: 1.6; text-align: center;">
        © ${new Date().getFullYear()} AuraSwift EPOS. All rights reserved.
      </p>
    </td>
  </tr>
  `;
}

/**
 * Create full email template with header, content, and footer
 * 
 * @param content - HTML content for the email body
 * @param title - Optional title for the email (defaults to empty)
 * @returns Complete HTML email template
 * 
 * @example
 * const html = createEmailTemplate(`
 *   <p>Your verification code is: 123456</p>
 * `);
 */
export function createEmailTemplate(content: string, title?: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${title ? `<title>${title}</title>` : ""}
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          ${emailHeader()}
          <tr>
            <td style="padding: 0 40px 30px;">
              ${content}
            </td>
          </tr>
          ${emailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Create a CTA button for emails
 * 
 * @param url - Destination URL
 * @param text - Button text
 * @param color - Button background color (defaults to blue)
 * @returns HTML for a styled button
 * 
 * @example
 * const button = createEmailButton("https://example.com", "Click Here");
 */
export function createEmailButton(
  url: string,
  text: string,
  color: string = "#007bff"
): string {
  return `
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <a href="${url}" style="display: inline-block; padding: 14px 28px; background-color: ${color}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
          ${text}
        </a>
      </td>
    </tr>
  </table>
  `;
}

/**
 * Create a fallback link section (for when button doesn't work)
 * 
 * @param url - The URL to display
 * @param label - Optional label text
 * @returns HTML for fallback link section
 */
export function createFallbackLink(url: string, label?: string): string {
  return `
  <p style="margin: 20px 0; color: #666; font-size: 14px; line-height: 1.6;">
    ${label || "Or copy and paste this link into your browser:"}<br>
    <a href="${url}" style="color: #007bff; word-break: break-all; text-decoration: underline;">${url}</a>
  </p>
  `;
}

/**
 * Create an expiry notice section
 * 
 * @param expiryText - Expiry message
 * @returns HTML for expiry notice
 */
export function createExpiryNotice(expiryText: string): string {
  return `
  <p style="margin: 20px 0 0; color: #999; font-size: 14px; line-height: 1.6;">
    ${expiryText}
  </p>
  `;
}

/**
 * Create a heading for email content
 * 
 * @param text - Heading text
 * @param level - Heading level (2 or 3, defaults to 2)
 * @returns HTML for heading
 */
export function createHeading(text: string, level: 2 | 3 = 2): string {
  const size = level === 2 ? "24px" : "20px";
  const margin = level === 2 ? "0 0 20px" : "0 0 15px";
  
  return `<h${level} style="margin: ${margin}; color: #333; font-size: ${size};">${text}</h${level}>`;
}

/**
 * Create a paragraph for email content
 * 
 * @param text - Paragraph text
 * @param color - Text color (defaults to #666)
 * @returns HTML for paragraph
 */
export function createParagraph(text: string, color: string = "#666"): string {
  return `<p style="margin: 0 0 20px; color: ${color}; font-size: 16px; line-height: 1.6;">${text}</p>`;
}

