/**
 * Metrics Module
 *
 * Architecture:
 * - registry.ts: Central Prometheus registry
 * - http.metrics.ts: HTTP/API metrics
 * - db.metrics.ts: Database metrics
 * - Domain-specific metrics live in their respective modules (e.g., apps/api/src/modules/auth/auth.metrics.ts)
 *
 * Usage:
 * ```typescript
 * import { httpRequestCounter, dbQueryDuration } from '@repo/shared/metrics';
 *
 * httpRequestCounter.inc({ method: 'GET', route: '/users', status_code: '200' });
 * const timer = dbQueryDuration.startTimer({ operation: 'select', table: 'users' });
 * await query();
 * timer();
 * ```
 */

// Export registry and utility functions
export * from "./registry";

// Export infrastructure metrics
export * from "./http.metrics";
export * from "./db.metrics";
