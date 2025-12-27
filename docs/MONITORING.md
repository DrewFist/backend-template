# Metrics & Monitoring Guide

Complete guide for setting up and using the metrics monitoring stack for the backend template.

## Overview

The monitoring stack consists of:

- **API Server** (`apps/api`): Exposes metrics at `/metrics` endpoint
- **Docker Services**: Prometheus (metrics collection) + Grafana (visualization)
- **Monitoring Config** (`monitoring/`): Prometheus and Grafana configuration files

## Architecture

```
┌─────────────────┐
│   API Server    │ :8000
│  /metrics       │────┐
└─────────────────┘    │
                       │ scrapes
                       ▼
┌─────────────────┐    ┌─────────────────┐
│   Prometheus    │ :9090 →   Grafana   │ :8001
│ (time-series DB)│    │  (visualization)│
└─────────────────┘    └─────────────────┘
```

## Quick Start

### 1. Start All Services (Database + Monitoring)

```bash
# Start everything with Docker
docker compose -f docker-compose.dev.yml up -d

# Start the API server
bun run dev --filter=@repo/api
```

### 2. Access the Dashboards

- **API**: http://localhost:8000
- **API Metrics**: http://localhost:8000/metrics (raw Prometheus format)
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:8001
  - Username: `admin`
  - Password: `admin`

### 3. View the Dashboard

1. Open Grafana at http://localhost:3001
2. Login with admin/admin
3. Navigate to **Dashboards** → **API Metrics Dashboard**

## Available Metrics

### HTTP Metrics

- `http_requests_total` - Total HTTP requests
  - Labels: `method`, `route`, `status_code`
- `http_request_duration_seconds` - Request duration histogram
  - Labels: `method`, `route`, `status_code`

### Database Metrics

- `db_queries_total` - Total database queries
  - Labels: `operation`, `table`
- `db_query_duration_seconds` - Query duration histogram
  - Labels: `operation`, `table`
- `db_connection_pool_size` - Current connection pool size
- `db_connection_pool_idle` - Idle connections in pool

### OAuth Metrics

- `oauth_requests_total` - Total OAuth requests
  - Labels: `provider`
- `oauth_success_total` - Successful OAuth completions
  - Labels: `provider`
- `oauth_failures_total` - Failed OAuth attempts
  - Labels: `provider`, `reason`

## Dashboard Panels

The pre-configured Grafana dashboard includes:

### Overview Row

1. **Total Requests (5m)** - Request volume in last 5 minutes
2. **Error Rate** - Percentage of 5xx errors
3. **P95 Response Time** - 95th percentile latency
4. **DB Queries (5m)** - Database query volume

### HTTP Performance

5. **Request Rate by Method** - GET, POST, PUT, DELETE, etc.
6. **Request Rate by Status Code** - 2xx, 4xx, 5xx breakdown
7. **Response Time Percentiles** - P50, P95, P99 latency
8. **P95 Response Time by Route** - Per-endpoint performance

### Database Performance

9. **Database Queries by Operation** - SELECT, INSERT, UPDATE, DELETE
10. **P95 Database Query Duration by Table** - Per-table query performance

### OAuth Analytics

11. **OAuth Requests by Provider** - Google, GitHub, etc.

## Prometheus Queries

Access Prometheus UI at http://localhost:9090 to run custom queries:

### Request Rate

```promql
# Total request rate
rate(http_requests_total[5m])

# Request rate by route
sum(rate(http_requests_total[5m])) by (route)
```

### Error Rate

```promql
# Overall error rate
sum(rate(http_requests_total{status_code=~"5.."}[5m])) /
sum(rate(http_requests_total[5m]))

# Error rate by route
sum(rate(http_requests_total{status_code=~"5.."}[5m])) by (route) /
sum(rate(http_requests_total[5m])) by (route)
```

### Latency

```promql
# P50 latency
histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# P95 latency
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# P99 latency
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# P95 latency by route
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))
```

### Database Performance

```promql
# Query rate by operation
sum(rate(db_query_duration_seconds_count[5m])) by (operation)

# Query duration by table
histogram_quantile(0.95, sum(rate(db_query_duration_seconds_bucket[5m])) by (le, table))
```

## Configuration Files

### Prometheus Configuration

**Location**: `infra/monitoring/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: "api-server"
    metrics_path: "/metrics"
    static_configs:
      - targets: ["host.docker.internal:8000"]
```

**Key Settings**:

- `scrape_interval`: How often to scrape metrics (15s)
- `targets`: Where to scrape from (API server)

### Grafana Datasource

**Location**: `infra/monitoring/grafana/provisioning/datasources/prometheus.yml`

Automatically provisions Prometheus as the default datasource.

### Grafana Dashboards

**Location**: `infra/monitoring/grafana/dashboards/`

Place JSON dashboard files here for automatic loading.

## Docker Compose Configuration

**Location**: `docker-compose.dev.yml`

Services:

- `postgres`: PostgreSQL database (port 5432)
- `prometheus`: Metrics collection (port 9090)
- `grafana`: Metrics visualization (port 8001)

All services share the `backend-network` network.

## Adding Custom Metrics

### 1. Define Metrics

Create a metrics file in your module:

```typescript
// apps/api/src/modules/mymodule/mymodule.metrics.ts
import { Counter, Histogram } from "prom-client";
import { metricsRegistry } from "@repo/shared/metrics";

export const myCustomCounter = new Counter({
  name: "my_custom_operations_total",
  help: "Total number of custom operations",
  labelNames: ["operation_type", "status"],
  registers: [metricsRegistry],
});

export const myCustomDuration = new Histogram({
  name: "my_custom_operation_duration_seconds",
  help: "Duration of custom operations",
  labelNames: ["operation_type"],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});
```

### 2. Use Metrics

```typescript
// In your handler or service
import { myCustomCounter, myCustomDuration } from "./mymodule.metrics";

export async function myOperation() {
  const timer = myCustomDuration.startTimer({ operation_type: "batch" });

  try {
    // Your operation
    await doSomething();

    myCustomCounter.inc({ operation_type: "batch", status: "success" });
  } catch (error) {
    myCustomCounter.inc({ operation_type: "batch", status: "error" });
    throw error;
  } finally {
    timer();
  }
}
```

### 3. Create Dashboard Panel

1. Open Grafana
2. Go to your dashboard
3. Click "Add panel"
4. Enter your PromQL query:
   ```promql
   rate(my_custom_operations_total[5m])
   ```
5. Configure visualization and save

## Managing Services

### Start Services

```bash
# Start all services (Docker + API + Metrics)
bun run dev

# Start Docker services only
bun run dev:services

# Start specific Docker service
docker compose -f docker-compose.dev.yml up -d prometheus
```

### Stop Services

```bash
# Stop all Docker services
bun run stop

# Stop and remove volumes
docker compose -f docker-compose.dev.yml down -v
```

### View Logs

```bash
# All Docker services
bun run logs

# Specific service
docker compose -f docker-compose.dev.yml logs -f prometheus
docker compose -f docker-compose.dev.yml logs -f grafana
```

### Restart Services

```bash
# Restart all
docker compose -f docker-compose.dev.yml restart

# Restart specific service
docker compose -f docker-compose.dev.yml restart prometheus
```

## Troubleshooting

### Prometheus Can't Connect to API

**Symptom**: No data in Grafana, Prometheus targets show "down"

**Solutions**:

1. Verify API is running: `curl http://localhost:3000/metrics`
2. Check Docker can access host:
   ```bash
   docker exec backend-prometheus wget -O- http://host.docker.internal:3000/metrics
   ```
3. On Linux, replace `host.docker.internal` with `172.17.0.1` in `prometheus.yml`

### No Data in Grafana

**Symptom**: Dashboard panels show "No data"

**Solutions**:

1. Check Prometheus targets: http://localhost:9090/targets
2. Verify datasource in Grafana settings
3. Ensure time range includes recent data
4. Run query in Prometheus UI first to verify data exists

### Grafana Won't Start

**Symptom**: Container keeps restarting

**Solutions**:

1. Check logs: `docker compose -f docker-compose.dev.yml logs grafana`
2. Verify volume permissions
3. Remove and recreate volume:
   ```bash
   docker compose -f docker-compose.dev.yml down -v
   docker compose -f docker-compose.dev.yml up -d
   ```

### Dashboard Shows Old Data

**Symptom**: Stale metrics or missing recent data

**Solutions**:

1. Check dashboard refresh interval (top-right)
2. Verify Prometheus scrape interval in config
3. Reload Prometheus config:
   ```bash
   curl -X POST http://localhost:9090/-/reload
   ```

## Production Considerations

### Security

1. **Change Grafana credentials**:

   ```yaml
   # docker-compose.dev.yml
   environment:
     - GF_SECURITY_ADMIN_PASSWORD=your-secure-password
   ```

2. **Don't expose ports publicly**: Use reverse proxy

3. **Enable authentication**: Configure Grafana auth providers

### Performance

1. **Increase Prometheus retention**:

   ```yaml
   command:
     - "--storage.tsdb.retention.time=30d"
   ```

2. **Adjust scrape interval**: Balance between data granularity and load

3. **Use recording rules**: Pre-calculate expensive queries

### Scaling

1. **Multiple API instances**: Update Prometheus config:

   ```yaml
   static_configs:
     - targets:
         - "api-1:3000"
         - "api-2:3000"
   ```

2. **Service discovery**: Use Prometheus service discovery for dynamic targets

3. **Federation**: Use Prometheus federation for distributed setups

### Backup

```bash
# Backup Grafana dashboards
docker exec backend-grafana grafana-cli admin export-dashboard > backup.json

# Backup Prometheus data
docker cp backend-prometheus:/prometheus ./prometheus-backup
```

## Best Practices

1. **Label Cardinality**: Keep label values bounded (don't use user IDs, timestamps)
2. **Naming Convention**: Use `<namespace>_<subsystem>_<name>_<unit>`
3. **Metric Types**:
   - Counter: Monotonically increasing values (requests, errors)
   - Histogram: Distributions (latency, request size)
   - Gauge: Values that can go up/down (connection pool, queue size)
4. **Aggregation**: Design metrics for aggregation (use labels wisely)
5. **Documentation**: Add `help` text to all custom metrics

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Guide](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Best Practices](https://prometheus.io/docs/practices/naming/)
