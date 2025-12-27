import { Counter } from "prom-client";

/**
 * Auth Module Metrics
 * Domain-specific metrics for authentication and OAuth
 */

// OAuth events counter
export const oauthEventsCounter = new Counter({
  name: "oauth_events_total",
  help: "Total number of OAuth events",
  labelNames: ["provider", "event_type"],
});

// Session operations counter
export const sessionOpsCounter = new Counter({
  name: "session_operations_total",
  help: "Total number of session operations",
  labelNames: ["operation", "result"],
});

// Token operations counter
export const tokenOpsCounter = new Counter({
  name: "token_operations_total",
  help: "Total number of token operations (JWT, refresh)",
  labelNames: ["operation", "result"],
});

// Auth failures counter
export const authFailuresCounter = new Counter({
  name: "auth_failures_total",
  help: "Total number of authentication failures",
  labelNames: ["reason", "provider"],
});
