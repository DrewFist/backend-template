import { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { logger } from "./logger";
import { StatusCodes } from "@repo/config";
import { httpErrorCounter } from "./metrics/http.metrics";

export function errorHandler(err: Error, c: Context) {
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const errors: Record<string, string> = {};

    err.issues.forEach((issue) => {
      const path = issue.path.join(".") || "unknown";
      errors[path] = issue.message;
    });

    // Track validation error in metrics
    httpErrorCounter.inc({
      method: c.req.method,
      route: c.req.path,
      status_code: StatusCodes.HTTP_400_BAD_REQUEST,
      error_type: "validation_error",
    });

    return c.json(
      {
        message: "Validation failed",
        errors,
      },
      StatusCodes.HTTP_400_BAD_REQUEST,
    );
  }

  // Handle HTTP exceptions (thrown by handlers)
  if (err instanceof HTTPException) {
    // If the HTTPException has a custom response, return it
    if (err.res) {
      return err.res;
    }

    logger.error("HTTP Exception", {
      module: "system",
      action: "http_exception",
      status: err.status,
      message: err.message,
      path: c.req.path,
    });

    return c.json(
      {
        message: err.message || "An error occurred",
      },
      err.status,
    );
  }

  // Handle all other uncaught errors
  logger.error("Uncaught exception", {
    module: "system",
    action: "uncaught_exception",
    error: err.message,
    stack: err.stack,
    path: c.req.path,
  });

  // Track uncaught exception in metrics
  httpErrorCounter.inc({
    method: c.req.method,
    route: c.req.path,
    status_code: StatusCodes.HTTP_500_INTERNAL_SERVER_ERROR,
    error_type: "uncaught_exception",
  });

  return c.json(
    {
      message: "Internal Server Error",
    },
    StatusCodes.HTTP_500_INTERNAL_SERVER_ERROR,
  );
}

export function notFoundHandler(c: Context) {
  logger.warn("Route not found", {
    module: "system",
    action: "not_found",
    path: c.req.path,
    method: c.req.method,
  });

  return c.json(
    {
      message: "Route not found",
    },
    404,
  );
}
