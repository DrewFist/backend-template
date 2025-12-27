# Monitoring

Prometheus and Grafana configuration for monitoring all services in the monorepo.

## Structure

```
infra/monitoring/
├── prometheus.yml              # Prometheus scrape configuration
├── grafana/
│   ├── dashboards/            # Grafana dashboard JSON files
│   │   └── api-metrics.json   # API service dashboard
│   └── provisioning/
│       ├── dashboards/        # Dashboard provisioning config
│       └── datasources/       # Datasource provisioning config
```

## Quick Start

```bash
# Start all services including monitoring
docker compose -f docker-compose.dev.yml up -d
```

## Accessing Services

| Service    | URL                   | Credentials   |
| ---------- | --------------------- | ------------- |
| Prometheus | http://localhost:9090 | -             |
| Grafana    | http://localhost:8001 | admin / admin |

## Adding Dashboards for New Services

1. Create a new dashboard JSON in `monitoring/grafana/dashboards/`
2. Name it `{service}-metrics.json`
3. Restart Grafana to pick up the new dashboard:
   ```bash
   docker compose -f docker-compose.dev.yml restart grafana
   ```

## Adding New Scrape Targets

Edit `prometheus.yml` to add new services:

```yaml
scrape_configs:
  - job_name: "api-server"
    # ... existing config

  - job_name: "new-service"
    metrics_path: "/metrics"
    static_configs:
      - targets: ["host.docker.internal:PORT"]
        labels:
          service: "new-service"
          environment: "ENVIRONMENT_PLACEHOLDER"
```

## Environment Variables

| Variable             | Default                     | Description                 |
| -------------------- | --------------------------- | --------------------------- |
| `API_METRICS_TARGET` | `host.docker.internal:8000` | API server metrics endpoint |
| `PROMETHEUS_PORT`    | `9090`                      | Prometheus web UI port      |
| `GRAFANA_PORT`       | `8001`                      | Grafana web UI port         |

## Production Considerations

1. **Security**: Change default Grafana credentials via environment variables
2. **Storage**: Volumes are configured for persistent data
3. **Alerting**: Configure Grafana alerting for critical metrics
4. **Scaling**: Update Prometheus targets for multiple service instances
