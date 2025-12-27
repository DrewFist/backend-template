import { Counter, Histogram } from "prom-client";
import { metricsRegistry } from "./registry";

/**
 * HTTP Metrics
 * Tracks HTTP request/response metrics
 */

// HTTP request duration histogram
export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

// HTTP request counter
export const httpRequestCounter = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [metricsRegistry],
});

// HTTP error counter
export const httpErrorCounter = new Counter({
  name: "http_errors_total",
  help: "Total number of HTTP errors",
  labelNames: ["method", "route", "status_code", "error_type"],
  registers: [metricsRegistry],
});
