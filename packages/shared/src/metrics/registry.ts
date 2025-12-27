import { register, Registry } from "prom-client";

/**
 * Central Prometheus registry
 * All metrics should be registered here
 */
export const metricsRegistry = register;

/**
 * Get metrics in Prometheus format
 */
export async function getMetrics() {
  return await metricsRegistry.metrics();
}

/**
 * Get content type for Prometheus metrics
 */
export function getMetricsContentType() {
  return metricsRegistry.contentType;
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics() {
  metricsRegistry.clear();
}

/**
 * Create a custom registry for isolated metric collection
 * Useful for testing or multi-tenant scenarios
 */
export function createCustomRegistry(): Registry {
  return new Registry();
}
