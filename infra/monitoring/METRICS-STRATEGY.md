# Metrics Strategy Guide

Standard practices for implementing metrics across all services in the monorepo.

## Metric Naming Conventions

### Format

```
{domain}_{metric_name}_{unit}
```

### Rules

1. **Prefix with domain**: `http_`, `db_`, `auth_`, `queue_`, etc.
2. **Use snake_case**: `http_request_duration_seconds`
3. **Include unit suffix**: `_seconds`, `_bytes`, `_total`, `_ratio`
4. **Counters end with `_total`**: `http_requests_total`

### Examples

| Metric Type | Example                         | Description                  |
| ----------- | ------------------------------- | ---------------------------- |
| Counter     | `http_requests_total`           | Total HTTP requests          |
| Counter     | `db_errors_total`               | Total database errors        |
| Histogram   | `http_request_duration_seconds` | Request latency distribution |
| Histogram   | `db_query_duration_seconds`     | Query latency distribution   |
| Gauge       | `db_connections_active`         | Current active connections   |
| Gauge       | `queue_messages_pending`        | Messages waiting in queue    |

## Metric Types & When to Use

### Counter

**Use for**: Events that only increase (requests, errors, completions)

```typescript
import { Counter } from "prom-client";

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

// Usage
httpRequestsTotal.inc({ method: "GET", route: "/users", status_code: "200" });
```

### Histogram

**Use for**: Measuring distributions (latency, sizes)

```typescript
import { Histogram } from "prom-client";

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1, 2, 5],
});

// Usage
const timer = httpRequestDuration.startTimer();
await handleRequest();
timer({ method: "GET", route: "/users", status_code: "200" });
```

### Gauge

**Use for**: Values that go up and down (connections, queue size, memory)

```typescript
import { Gauge } from "prom-client";

export const dbConnectionsActive = new Gauge({
  name: "db_connections_active",
  help: "Number of active database connections",
});

// Usage
dbConnectionsActive.inc(); // Connection opened
dbConnectionsActive.dec(); // Connection closed
dbConnectionsActive.set(5); // Set to specific value
```

## Standard Labels

### HTTP Metrics

| Label         | Values                        | Description              |
| ------------- | ----------------------------- | ------------------------ |
| `method`      | GET, POST, PUT, DELETE, PATCH | HTTP method              |
| `route`       | /v1/users, /v1/auth/login     | Route pattern (not path) |
| `status_code` | 200, 201, 400, 401, 500       | HTTP status code         |

### Database Metrics

| Label       | Values                         | Description        |
| ----------- | ------------------------------ | ------------------ |
| `operation` | select, insert, update, delete | SQL operation type |
| `table`     | users, sessions, orders        | Table name         |

### Auth Metrics

| Label        | Values                    | Description   |
| ------------ | ------------------------- | ------------- |
| `provider`   | google, github, email     | Auth provider |
| `event_type` | login:success, login:fail | Event outcome |

### Queue Metrics

| Label    | Values                     | Description    |
| -------- | -------------------------- | -------------- |
| `queue`  | emails, notifications      | Queue name     |
| `status` | pending, processed, failed | Message status |

## Adding Metrics to a New Service

### Step 1: Create Metrics File

```typescript
// apps/{service}/src/metrics.ts
import { Counter, Histogram, Gauge } from "prom-client";

// Service-specific metrics
export const serviceRequestsTotal = new Counter({
  name: "{service}_requests_total",
  help: "Total requests to {service}",
  labelNames: ["operation", "status"],
});

export const serviceOperationDuration = new Histogram({
  name: "{service}_operation_duration_seconds",
  help: "Duration of {service} operations",
  labelNames: ["operation"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});
```

### Step 2: Expose /metrics Endpoint

```typescript
// apps/{service}/src/index.ts
import { getMetrics, getMetricsContentType } from "@repo/shared";

app.get("/metrics", async (c) => {
  const metrics = await getMetrics();
  return c.text(metrics, 200, {
    "Content-Type": getMetricsContentType(),
  });
});
```

### Step 3: Add Prometheus Scrape Target

```yaml
# infra/monitoring/prometheus.yml
scrape_configs:
  - job_name: "api-server"
    # ... existing

  - job_name: "{service}-server"
    metrics_path: "/metrics"
    static_configs:
      - targets: ["{SERVICE}_METRICS_TARGET_PLACEHOLDER"]
        labels:
          service: "{service}"
          environment: "ENVIRONMENT_PLACEHOLDER"
```

### Step 4: Update Docker Compose

```yaml
# docker-compose.dev.yml
prometheus:
  environment:
    - {SERVICE}_METRICS_TARGET=${SERVICE_METRICS_TARGET:-host.docker.internal:PORT}
```

### Step 5: Create Grafana Dashboard

Create `infra/monitoring/grafana/dashboards/{service}-metrics.json` with relevant panels.

## Dashboard Organization

### Folder Structure

```
infra/monitoring/grafana/dashboards/
├── api-metrics.json         # API service dashboard
├── worker-metrics.json      # Background worker dashboard
├── gateway-metrics.json     # API gateway dashboard
└── system-overview.json     # Cross-service overview
```

### Standard Dashboard Sections

1. **Overview Row** - Key stats (requests, errors, latency, throughput)
2. **Traffic** - Request rates, status codes, methods
3. **Latency** - P50/P95/P99, by route/operation
4. **Errors** - Error rates, error types, failure reasons
5. **Resources** - Connections, memory, CPU (if applicable)
6. **Business Metrics** - Domain-specific (signups, orders, etc.)

## Alerting Strategy (Future)

### Critical Alerts (Page immediately)

- Error rate > 5% for 5 minutes
- P99 latency > 5s for 5 minutes
- Service down (no metrics for 1 minute)
- Database connection pool exhausted

### Warning Alerts (Notify during business hours)

- Error rate > 1% for 15 minutes
- P95 latency > 2s for 15 minutes
- Queue backlog > 1000 messages

### Info Alerts (Log only)

- Unusual traffic patterns
- High memory usage

## Shared Package: @repo/shared/metrics

### Available Exports

```typescript
// Registry & utilities
export { metricsRegistry, getMetrics, getMetricsContentType } from "./registry";

// HTTP metrics (use via metricsMiddleware)
export { httpRequestsTotal, httpRequestDuration, httpErrorsTotal } from "./http.metrics";

// Database metrics (use via withMetrics wrapper)
export { dbQueryDuration, dbConnectionsGauge, dbErrorCounter } from "./db.metrics";
```

### Using the Metrics Middleware

```typescript
import { metricsMiddleware } from "@repo/shared";

// Automatically tracks HTTP requests
app.use(metricsMiddleware());
```

### Using the DB Metrics Wrapper

```typescript
import { withMetrics } from "@repo/db";

// Automatically tracks query duration
const users = await withMetrics("select", "users", async () => db.select().from(usersTable));
```

## Module-Specific Metrics

Domain metrics should live in their respective modules:

```
apps/api/src/modules/
├── auth/
│   ├── auth.metrics.ts      # OAuth, session, token metrics
│   └── ...
├── payments/
│   ├── payments.metrics.ts  # Transaction, refund metrics
│   └── ...
└── notifications/
    ├── notifications.metrics.ts  # Email, push metrics
    └── ...
```

### Example: Auth Module Metrics

```typescript
// apps/api/src/modules/auth/auth.metrics.ts
import { Counter } from "prom-client";

export const oauthEventsCounter = new Counter({
  name: "oauth_events_total",
  help: "Total OAuth events",
  labelNames: ["provider", "event_type"],
});

export const sessionOpsCounter = new Counter({
  name: "session_operations_total",
  help: "Total session operations",
  labelNames: ["operation", "result"],
});

export const authFailuresCounter = new Counter({
  name: "auth_failures_total",
  help: "Total auth failures",
  labelNames: ["reason", "provider"],
});
```

## Quick Reference: Common PromQL Queries

### Request Rate

```promql
sum(rate(http_requests_total[5m])) by (service)
```

### Error Rate Percentage

```promql
sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100
```

### P95 Latency

```promql
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
```

### Throughput (requests/sec)

```promql
sum(rate(http_requests_total[1m]))
```

### Slow Endpoints (P95 > 1s)

```promql
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)) > 1
```

## Checklist: Adding Metrics to New Feature

- [ ] Identify key operations to measure
- [ ] Choose appropriate metric types (counter/histogram/gauge)
- [ ] Follow naming conventions
- [ ] Use standard labels where applicable
- [ ] Create metrics file in module directory
- [ ] Instrument code with metrics
- [ ] Add dashboard panel for new metrics
- [ ] Test metrics appear in /metrics endpoint
- [ ] Verify Prometheus is scraping correctly
