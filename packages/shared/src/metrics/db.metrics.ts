import { Gauge, Histogram, Counter } from "prom-client";
import { metricsRegistry } from "./registry";

/**
 * Database Metrics
 * Tracks database connection and query performance
 */

// Active database connections
export const dbConnectionsGauge = new Gauge({
  name: "db_connections_active",
  help: "Number of active database connections",
  registers: [metricsRegistry],
});

// Database query duration
export const dbQueryDuration = new Histogram({
  name: "db_query_duration_seconds",
  help: "Duration of database queries in seconds",
  labelNames: ["operation", "table"],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

// Database transaction duration
export const dbTransactionDuration = new Histogram({
  name: "db_transaction_duration_seconds",
  help: "Duration of database transactions in seconds",
  labelNames: ["result"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

// Database errors counter
export const dbErrorCounter = new Counter({
  name: "db_errors_total",
  help: "Total number of database errors",
  labelNames: ["operation", "error_type"],
  registers: [metricsRegistry],
});
