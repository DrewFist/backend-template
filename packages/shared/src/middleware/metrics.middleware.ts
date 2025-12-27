import type { MiddlewareHandler } from "hono";
import { httpRequestDuration, httpRequestCounter, httpErrorCounter } from "../metrics/http.metrics";

/**
 * Prometheus metrics middleware that automatically tracks HTTP metrics
 */
export const metricsMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const start = Date.now();
    const path = c.req.routePath || c.req.path;

    try {
      await next();

      const duration = (Date.now() - start) / 1000;
      const status = c.res.status;
      const method = c.req.method;

      // Record metrics
      httpRequestDuration.observe({ method, route: path, status_code: status }, duration);
      httpRequestCounter.inc({ method, route: path, status_code: status });

      // Track errors
      if (status >= 400) {
        httpErrorCounter.inc({
          method,
          route: path,
          status_code: status,
          error_type: status >= 500 ? "server_error" : "client_error",
        });
      }
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      const method = c.req.method;

      // Record error metrics
      httpRequestDuration.observe({ method, route: path, status_code: 500 }, duration);
      httpRequestCounter.inc({ method, route: path, status_code: 500 });
      httpErrorCounter.inc({
        method,
        route: path,
        status_code: 500,
        error_type: "server_error",
      });

      throw error;
    }
  };
};
