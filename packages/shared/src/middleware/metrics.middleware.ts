import type { MiddlewareHandler } from "hono";
import { getPath } from "hono/utils/url";
import { routePath } from "hono/route";
import { httpRequestDuration, httpRequestCounter, httpErrorCounter } from "../metrics/http.metrics";

/**
 * Prometheus metrics middleware that automatically tracks HTTP metrics
 * Must be applied BEFORE routes are registered to capture accurate route patterns
 */
export const metricsMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const start = Date.now();

    try {
      await next();

      // Get route pattern AFTER next() - this is when Hono has matched the route
      const route = routePath(c) || getPath(c.req.raw);
      const duration = (Date.now() - start) / 1000;
      const status = c.res.status;
      const method = c.req.method;

      // Record metrics
      httpRequestDuration.observe({ method, route, status_code: status }, duration);
      httpRequestCounter.inc({ method, route, status_code: status });

      // Track errors
      if (status >= 400) {
        httpErrorCounter.inc({
          method,
          route,
          status_code: status,
          error_type: status >= 500 ? "server_error" : "client_error",
        });
      }
    } catch (error) {
      // Get route pattern even on error
      const route = routePath(c) || getPath(c.req.raw);
      const duration = (Date.now() - start) / 1000;
      const method = c.req.method;

      // Record error metrics
      httpRequestDuration.observe({ method, route, status_code: 500 }, duration);
      httpRequestCounter.inc({ method, route, status_code: 500 });
      httpErrorCounter.inc({
        method,
        route,
        status_code: 500,
        error_type: "server_error",
      });

      throw error;
    }
  };
};
