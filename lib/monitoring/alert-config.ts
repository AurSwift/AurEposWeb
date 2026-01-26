/**
 * Monitoring & Alerts Configuration
 * Provides health monitoring and alerting for critical system metrics
 */

export interface AlertThresholds {
  healthScore: {
    critical: number;
    degraded: number;
  };
  dlqSize: {
    critical: number;
    warning: number;
  };
  failureRate: {
    critical: number;
    warning: number;
  };
  staleSessions: {
    warning: number;
  };
}

export const ALERT_THRESHOLDS: AlertThresholds = {
  healthScore: {
    critical: 40, // Health score below 40
    degraded: 60, // Health score below 60
  },
  dlqSize: {
    critical: 100, // 100+ events in DLQ
    warning: 50, // 50+ events in DLQ
  },
  failureRate: {
    critical: 20, // 20%+ failure rate
    warning: 10, // 10%+ failure rate
  },
  staleSessions: {
    warning: 10, // 10+ stale sessions detected
  },
};

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertType =
  | "health_score_critical"
  | "health_score_degraded"
  | "dlq_size_critical"
  | "dlq_size_warning"
  | "failure_rate_critical"
  | "failure_rate_warning"
  | "stale_sessions_warning"
  | "pattern_detected";

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  licenseKey?: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

export interface AlertChannel {
  type: "webhook" | "email" | "slack" | "discord";
  enabled: boolean;
  config: Record<string, unknown>;
}

/**
 * Alert configuration for different channels
 */
export const ALERT_CHANNELS: Record<string, AlertChannel> = {
  webhook: {
    type: "webhook",
    enabled: !!process.env.ALERT_WEBHOOK_URL,
    config: {
      url: process.env.ALERT_WEBHOOK_URL,
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.ALERT_WEBHOOK_SECRET || "",
      },
    },
  },
  slack: {
    type: "slack",
    enabled: !!process.env.SLACK_WEBHOOK_URL,
    config: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
    },
  },
  discord: {
    type: "discord",
    enabled: !!process.env.DISCORD_WEBHOOK_URL,
    config: {
      webhookUrl: process.env.DISCORD_WEBHOOK_URL,
    },
  },
  email: {
    type: "email",
    enabled: !!process.env.ALERT_EMAIL_TO,
    config: {
      to: process.env.ALERT_EMAIL_TO,
      from: process.env.ALERT_EMAIL_FROM || "alerts@aurswift.com",
    },
  },
};

/**
 * Check if alerts are enabled
 */
export function isAlertingEnabled(): boolean {
  return Object.values(ALERT_CHANNELS).some((channel) => channel.enabled);
}

/**
 * Get enabled alert channels
 */
export function getEnabledChannels(): AlertChannel[] {
  return Object.values(ALERT_CHANNELS).filter((channel) => channel.enabled);
}
