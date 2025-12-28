import { OpenAPIHono } from "@hono/zod-openapi";
import { requestId } from "hono/request-id";
import { errorHandler, notFoundHandler } from "./error-handler";
import { StatusCodes } from "@repo/config";
import type { Env } from "hono";

export function createRouter<E extends Env = Env>() {
  return new OpenAPIHono<E>({
    strict: false,
    defaultHook: (result, c) => {
      if (!result.success) {
        const errors: Record<string, string> = {};

        result.error.issues.forEach((issue) => {
          const path = issue.path.join(".") || "unknown";
          errors[path] = issue.message;
        });

        return c.json(
          {
            message: "Validation failed",
            errors,
          },
          StatusCodes.HTTP_400_BAD_REQUEST,
        );
      }
    },
  });
}

export function createApp<E extends Env = Env>() {
  const app = createRouter<E>();
  app.use(requestId());

  // Global error handler
  app.onError(errorHandler);

  // 404 handler for undefined routes
  app.notFound(notFoundHandler);

  return app;
}
