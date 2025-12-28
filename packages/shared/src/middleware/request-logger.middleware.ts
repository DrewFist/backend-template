import type { MiddlewareHandler } from "hono";
import { logger } from "../logger";
import { randomUUID } from "crypto";

/**
 * Request logger middleware that logs incoming requests and responses
 * Adds correlation ID for request tracing
 */
export const requestLogger = (): MiddlewareHandler => {
  return async (c, next) => {
    const path = c.req.path;

    // Skip logging for metrics endpoint to avoid flooding logs
    if (path === "/metrics") {
      return await next();
    }

    const start = Date.now();
    const requestId = c.req.header("x-request-id") || randomUUID();

    // Add request ID to response headers for tracing
    c.header("x-request-id", requestId);

    // Create child logger with request context
    const reqLogger = logger.child({
      requestId,
      module: "http",
    });

    // Log incoming request
    reqLogger.info({
      action: "request:incoming",
      method: c.req.method,
      path: c.req.path,
      userAgent: c.req.header("user-agent"),
      ip: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    });

    // Store logger in context for use in handlers
    c.set("logger", reqLogger);

    let error: Error | undefined;

    try {
      await next();
    } catch (err) {
      error = err as Error;
      throw err;
    } finally {
      const duration = Date.now() - start;
      const status = c.res.status;

      // Log response
      if (error) {
        reqLogger.error({
          action: "request:error",
          method: c.req.method,
          path: c.req.path,
          status,
          duration,
          err: error,
        });
      } else if (status >= 500) {
        reqLogger.error({
          action: "request:completed",
          method: c.req.method,
          path: c.req.path,
          status,
          duration,
        });
      } else if (status >= 400) {
        reqLogger.warn({
          action: "request:completed",
          method: c.req.method,
          path: c.req.path,
          status,
          duration,
        });
      } else {
        reqLogger.info({
          action: "request:completed",
          method: c.req.method,
          path: c.req.path,
          status,
          duration,
        });
      }
    }
  };
};
