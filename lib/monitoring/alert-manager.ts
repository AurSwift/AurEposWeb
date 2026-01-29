/**
 * Alert Manager
 * Handles alert creation, notification, and delivery to various channels
 */

import {
  Alert,
  AlertSeverity,
  AlertType,
  ALERT_CHANNELS,
  getEnabledChannels,
} from "./alert-config";

/**
 * Create and send an alert
 */
export async function sendAlert(
  type: AlertType,
  severity: AlertSeverity,
  title: string,
  message: string,
  metadata: Record<string, unknown> = {},
  licenseKey?: string
): Promise<void> {
  const alert: Alert = {
    id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    severity,
    title,
    message,
    licenseKey,
    metadata,
    timestamp: new Date(),
  };

  console.log(`🚨 Alert [${severity.toUpperCase()}]: ${title}`, metadata);

  // Send to all enabled channels
  const channels = getEnabledChannels();
  const promises = channels.map((channel) => {
    switch (channel.type) {
      case "webhook":
        return sendWebhookAlert(alert, channel);
      case "slack":
        return sendSlackAlert(alert, channel);
      case "discord":
        return sendDiscordAlert(alert, channel);
      case "email":
        return sendEmailAlert(alert, channel);
      default:
        return Promise.resolve();
    }
  });

  await Promise.allSettled(promises);
}

/**
 * Send alert via webhook
 */
async function sendWebhookAlert(
  alert: Alert,
  channel: { config: Record<string, unknown> }
): Promise<void> {
  try {
    const url = channel.config.url as string;
    const headers = channel.config.headers as Record<string, string>;

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        alert,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to send webhook alert:", error);
  }
}

/**
 * Send alert to Slack
 */
async function sendSlackAlert(
  alert: Alert,
  channel: { config: Record<string, unknown> }
): Promise<void> {
  try {
    const webhookUrl = channel.config.webhookUrl as string;

    const color =
      alert.severity === "critical"
        ? "danger"
        : alert.severity === "warning"
        ? "warning"
        : "good";

    const emoji =
      alert.severity === "critical"
        ? "🔴"
        : alert.severity === "warning"
        ? "⚠️"
        : "ℹ️";

    const payload = {
      attachments: [
        {
          color,
          title: `${emoji} ${alert.title}`,
          text: alert.message,
          fields: [
            {
              title: "Severity",
              value: alert.severity.toUpperCase(),
              short: true,
            },
            {
              title: "Type",
              value: alert.type,
              short: true,
            },
            ...(alert.licenseKey
              ? [
                  {
                    title: "License Key",
                    value: alert.licenseKey,
                    short: true,
                  },
                ]
              : []),
            ...Object.entries(alert.metadata).map(([key, value]) => ({
              title: key,
              value: String(value),
              short: true,
            })),
          ],
          footer: "AurSwift Monitoring",
          ts: Math.floor(alert.timestamp.getTime() / 1000),
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook returned ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to send Slack alert:", error);
  }
}

/**
 * Send alert to Discord
 */
async function sendDiscordAlert(
  alert: Alert,
  channel: { config: Record<string, unknown> }
): Promise<void> {
  try {
    const webhookUrl = channel.config.webhookUrl as string;

    const color =
      alert.severity === "critical"
        ? 0xff0000
        : alert.severity === "warning"
        ? 0xffa500
        : 0x00ff00;

    const payload = {
      embeds: [
        {
          title: alert.title,
          description: alert.message,
          color,
          fields: [
            {
              name: "Severity",
              value: alert.severity.toUpperCase(),
              inline: true,
            },
            {
              name: "Type",
              value: alert.type,
              inline: true,
            },
            ...(alert.licenseKey
              ? [
                  {
                    name: "License Key",
                    value: alert.licenseKey,
                    inline: true,
                  },
                ]
              : []),
            ...Object.entries(alert.metadata).map(([key, value]) => ({
              name: key,
              value: String(value),
              inline: true,
            })),
          ],
          footer: {
            text: "AurSwift Monitoring",
          },
          timestamp: alert.timestamp.toISOString(),
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook returned ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to send Discord alert:", error);
  }
}

/**
 * Send alert via email
 */
async function sendEmailAlert(
  alert: Alert,
  channel: { config: Record<string, unknown> }
): Promise<void> {
  try {
    // This is a placeholder - integrate with your email service (SendGrid, SES, etc.)
    console.log("Email alert would be sent:", {
      to: channel.config.to,
      from: channel.config.from,
      subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
      body: alert.message,
    });

    // Example SendGrid integration:
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // await sgMail.send({
    //   to: channel.config.to,
    //   from: channel.config.from,
    //   subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
    //   html: formatEmailHtml(alert),
    // });
  } catch (error) {
    console.error("Failed to send email alert:", error);
  }
}
