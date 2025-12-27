# Monitoring & Observability Guide

Complete guide for the monitoring stack: **Prometheus** (metrics), **Grafana** (visualization), and **Loki** (logs).

## Overview

The observability stack provides:

- **Metrics**: Prometheus collects time-series data from `/metrics` endpoint
- **Logs**: Loki aggregates structured logs from Pino logger
- **Visualization**: Grafana dashboards for metrics and log exploration

## Architecture

```
┌─────────────────┐
│   API Server    │ :8000
│  /metrics       │─────────────┐
│  (pino-loki)    │─────────┐   │
└─────────────────┘         │   │
                            │   │ scrapes metrics
                   pushes   │   │
                   logs     │   │
                            ▼   ▼
┌─────────────────┐    ┌─────────────────┐
│      Loki       │    │   Prometheus    │
│  (log storage)  │    │ (metrics store) │
│     :3100       │    │     :9090       │
└────────┬────────┘    └────────┬────────┘
         │                      │
         └──────────┬───────────┘
                    │
                    ▼
           ┌─────────────────┐
           │     Grafana     │ :8001
           │ (visualization) │
           └─────────────────┘
```

## Quick Start

### 1. Start All Services

```bash
# Start PostgreSQL + Prometheus + Grafana + Loki
docker compose -f docker-compose.dev.yml up -d

# Start the API server
bun run dev --filter=@repo/api
```

### 2. Access Dashboards

| Service    | URL                           | Credentials   |
| ---------- | ----------------------------- | ------------- |
| API        | http://localhost:8000         | -             |
| Metrics    | http://localhost:8000/metrics | -             |
| Prometheus | http://localhost:9090         | -             |
| Grafana    | http://localhost:8001         | admin / admin |
| Loki       | http://localhost:3100         | -             |

### 3. View Dashboards

1. Open Grafana at http://localhost:8001
2. Login with `admin` / `admin`
3. Navigate to **Dashboards**:
   - **API Metrics Dashboard** - HTTP, database, OAuth metrics
   - **API Logs Dashboard** - Log volume, errors, live log viewer

---

## Metrics

### Available Metrics

#### HTTP Metrics

| Metric                          | Type      | Labels                           | Description         |
| ------------------------------- | --------- | -------------------------------- | ------------------- |
| `http_requests_total`           | Counter   | `method`, `route`, `status_code` | Total HTTP requests |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Request duration    |

#### Database Metrics

| Metric                      | Type      | Labels               | Description            |
| --------------------------- | --------- | -------------------- | ---------------------- |
| `db_queries_total`          | Counter   | `operation`, `table` | Total database queries |
| `db_query_duration_seconds` | Histogram | `operation`, `table` | Query execution time   |
| `db_connection_pool_size`   | Gauge     | -                    | Current pool size      |
| `db_connection_pool_idle`   | Gauge     | -                    | Idle connections       |

#### OAuth Metrics

| Metric                 | Type    | Labels               | Description            |
| ---------------------- | ------- | -------------------- | ---------------------- |
| `oauth_events_total`   | Counter | `provider`, `event`  | OAuth events           |
| `oauth_success_total`  | Counter | `provider`           | Successful completions |
| `oauth_failures_total` | Counter | `provider`, `reason` | Failed attempts        |

### Adding Custom Metrics

#### 1. Define Metrics

```typescript
// apps/api/src/modules/mymodule/mymodule.metrics.ts
import { Counter, Histogram } from "prom-client";
import { metricsRegistry } from "@repo/shared/metrics";

export const myOperationsTotal = new Counter({
  name: "my_operations_total",
  help: "Total number of operations",
  labelNames: ["type", "status"],
  registers: [metricsRegistry],
});

export const myOperationDuration = new Histogram({
  name: "my_operation_duration_seconds",
  help: "Operation duration in seconds",
  labelNames: ["type"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});
```

#### 2. Use Metrics

```typescript
import { myOperationsTotal, myOperationDuration } from "./mymodule.metrics";

export async function performOperation(type: string) {
  const timer = myOperationDuration.startTimer({ type });

  try {
    await doWork();
    myOperationsTotal.inc({ type, status: "success" });
  } catch (error) {
    myOperationsTotal.inc({ type, status: "error" });
    throw error;
  } finally {
    timer();
  }
}
```

### Useful PromQL Queries

```promql
# Request rate (last 5 minutes)
rate(http_requests_total[5m])

# Error rate percentage
sum(rate(http_requests_total{status_code=~"5.."}[5m])) /
sum(rate(http_requests_total[5m])) * 100

# P95 latency by route
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)
)

# Database query rate by operation
sum(rate(db_queries_total[5m])) by (operation)

# Slowest database queries (P99)
histogram_quantile(0.99,
  sum(rate(db_query_duration_seconds_bucket[5m])) by (le, table)
)
```

---

## Logging with Loki

### How It Works

The API uses **Pino** logger with **pino-loki** transport to ship logs directly to Loki:

```typescript
// Logs are automatically shipped to Loki
logger.info("User logged in", {
  module: "auth",
  action: "login:success",
  userId: "123",
});
```

### Log Labels

Logs are indexed by these labels for efficient querying:

| Label         | Description                    |
| ------------- | ------------------------------ |
| `application` | Always "api"                   |
| `environment` | "development" or "production"  |
| `level`       | Log level (info, error, etc.)  |
| `module`      | Source module (auth, db, etc.) |

### Searching Logs in Grafana

1. Go to **Explore** (compass icon)
2. Select **Loki** datasource
3. Use LogQL queries:

```logql
# All API logs
{application="api"}

# Error logs only
{application="api", level="error"}

# Auth module logs
{application="api", module="auth"}

# Search for specific text
{application="api"} |= "login"

# JSON field filtering
{application="api"} | json | userId="123"

# Error logs with stack traces
{application="api"} |= "error" | json | line_format "{{.msg}} - {{.error}}"
```

### Log Levels

| Level   | Usage                                           |
| ------- | ----------------------------------------------- |
| `trace` | Detailed debugging (rarely enabled)             |
| `debug` | Development debugging                           |
| `info`  | Normal operational events                       |
| `warn`  | Potentially problematic situations              |
| `error` | Error conditions requiring attention            |
| `fatal` | Critical errors causing shutdown                |
| `audit` | Security-sensitive actions (via `logger.audit`) |

### Structured Logging Best Practices

Always include context in logs:

```typescript
// Good - structured with module and action
logger.info("OAuth callback received", {
  module: "auth",
  action: "oauth:callback",
  provider: "google",
  userId: user.id,
});

// Good - error with stack trace
logger.error("Database query failed", {
  module: "db",
  action: "query:select",
  error: err, // Error object serialized with stack
  table: "users",
});

// Security audit
logger.audit("Sensitive data accessed", {
  module: "security",
  action: "data:access",
  userId: user.id,
  resource: "user_tokens",
});
```

---

## Dashboard Panels

### API Metrics Dashboard

| Panel                      | Description                      |
| -------------------------- | -------------------------------- |
| Total Requests (5m)        | Request count in last 5 minutes  |
| Error Rate                 | Percentage of 5xx responses      |
| P95 Response Time          | 95th percentile latency          |
| DB Queries (5m)            | Database query count             |
| Request Rate by Method     | GET, POST, PUT, DELETE breakdown |
| Request Rate by Status     | 2xx, 4xx, 5xx distribution       |
| Response Time Percentiles  | P50, P95, P99 over time          |
| P95 Response Time by Route | Per-endpoint performance         |
| DB Queries by Operation    | SELECT, INSERT, UPDATE, DELETE   |
| OAuth Events               | OAuth requests by provider       |

### API Logs Dashboard

| Panel                | Description                              |
| -------------------- | ---------------------------------------- |
| Total Errors         | Error count in time range                |
| Total Warnings       | Warning count in time range              |
| Security Events      | Audit log count                          |
| Total Log Lines      | Overall log volume                       |
| Log Volume by Level  | Stacked chart of log levels over time    |
| Logs by Module       | Distribution across auth, db, http, etc. |
| Error Rate Over Time | Error trend visualization                |
| All Logs             | Live log viewer with JSON parsing        |
| Error Logs           | Filtered error-only log viewer           |

---

## Configuration

### Environment Variables

```bash
# Loki host for log shipping (default: http://localhost:3100)
LOKI_HOST=http://localhost:3100

# Log level (default: info)
LOG_LEVEL=debug
```

### File Locations

```
infra/monitoring/
├── prometheus.yml                    # Prometheus scrape config
├── loki/
│   └── loki-config.yml              # Loki storage config
└── grafana/
    ├── dashboards/
    │   ├── api-metrics.json         # Metrics dashboard
    │   └── api-logs.json            # Logs dashboard
    └── provisioning/
        ├── dashboards/
        │   └── dashboards.yml       # Dashboard auto-loading
        └── datasources/
            └── datasources.yml      # Prometheus + Loki sources
```

### Prometheus Configuration

```yaml
# infra/monitoring/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: "api-server"
    metrics_path: "/metrics"
    static_configs:
      - targets: ["host.docker.internal:8000"]
```

### Loki Configuration

```yaml
# infra/monitoring/loki/loki-config.yml
auth_enabled: false

server:
  http_listen_port: 3100

storage_config:
  tsdb_shipper:
    active_index_directory: /loki/index
    cache_location: /loki/cache
  filesystem:
    directory: /loki/chunks

limits_config:
  retention_period: 168h # 7 days
```

---

## Troubleshooting

### No Data in Grafana

1. **Check Prometheus targets**: http://localhost:9090/targets
2. **Verify API is exposing metrics**: `curl http://localhost:8000/metrics`
3. **Check Loki is receiving logs**: `curl http://localhost:3100/ready`
4. **Verify datasources in Grafana**: Settings → Data Sources

### Prometheus Can't Scrape API

```bash
# Test from within Docker network
docker exec prometheus wget -qO- http://host.docker.internal:8000/metrics

# On Linux, use host IP instead
# Replace host.docker.internal with 172.17.0.1
```

### Logs Not Appearing in Loki

1. **Check LOKI_HOST env var** is set correctly
2. **Verify Loki is running**: `docker compose logs loki`
3. **Check pino-loki errors** in API console output
4. **Test Loki push API**:
   ```bash
   curl -X POST http://localhost:3100/loki/api/v1/push \
     -H "Content-Type: application/json" \
     -d '{"streams":[{"stream":{"test":"true"},"values":[["'$(date +%s)000000000'","test log"]]}]}'
   ```

### Dashboard Shows Stale Data

1. Check refresh interval (top-right in Grafana)
2. Verify time range includes recent data
3. For Prometheus: `curl -X POST http://localhost:9090/-/reload`
4. For Grafana: Hard refresh the page (Cmd+Shift+R)

---

## Production Considerations

### Security

```yaml
# Change default Grafana password
environment:
  - GF_SECURITY_ADMIN_PASSWORD=secure-password
# Restrict Loki access - don't expose port 3100 publicly
```

### Retention

```yaml
# Prometheus retention (default 15 days)
command:
  - "--storage.tsdb.retention.time=30d"

# Loki retention (in loki-config.yml)
limits_config:
  retention_period: 720h # 30 days
```

### Performance

1. **Log sampling** for high-traffic routes
2. **Label cardinality** - avoid dynamic labels (user IDs, timestamps)
3. **Recording rules** for expensive PromQL queries
4. **Log level** - use `info` in production, `debug` only when needed

### Scaling

```yaml
# Multiple API instances
scrape_configs:
  - job_name: "api-servers"
    static_configs:
      - targets:
          - "api-1:8000"
          - "api-2:8000"
```

---

## Quick Reference

### Start/Stop Services

```bash
# Start all
docker compose -f docker-compose.dev.yml up -d

# Stop all
docker compose -f docker-compose.dev.yml down

# View logs
docker compose -f docker-compose.dev.yml logs -f grafana
docker compose -f docker-compose.dev.yml logs -f loki
docker compose -f docker-compose.dev.yml logs -f prometheus
```

### Useful URLs

- **API Docs**: http://localhost:8000/docs
- **Raw Metrics**: http://localhost:8000/metrics
- **Prometheus UI**: http://localhost:9090
- **Loki API**: http://localhost:3100/ready
- **Grafana**: http://localhost:8001

### LogQL Cheatsheet

```logql
# Filter by label
{application="api", level="error"}

# Text search
{application="api"} |= "error"
{application="api"} != "health"

# Regex search
{application="api"} |~ "user.*created"

# JSON parsing
{application="api"} | json

# Field extraction
{application="api"} | json | userId != ""

# Line formatting
{application="api"} | json | line_format "{{.level}}: {{.msg}}"

# Aggregations
sum(count_over_time({application="api"}[5m])) by (level)
```
