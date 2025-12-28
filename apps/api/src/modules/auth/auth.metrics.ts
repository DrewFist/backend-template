import { Counter } from "prom-client";
import { metricsRegistry } from "@repo/shared/metrics";

/**
 * Auth Module Metrics
 * Domain-specific metrics for authentication and OAuth
 */

// OAuth events counter - tracks successful logins and errors
export const oauthEventsCounter = new Counter({
  name: "oauth_events_total",
  help: "Total number of OAuth events",
  labelNames: ["provider", "event_type"],
  registers: [metricsRegistry],
});
