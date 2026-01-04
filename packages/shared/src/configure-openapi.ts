import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { logger } from "./logger";
import { Env } from "hono";

export function configureOpenAPI<E extends Env = Env>(
  app: OpenAPIHono<E>,
  config: {
    title: string;
    version: string;
  },
) {
  // Register Bearer Auth security scheme
  app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "Enter your JWT access token (legacy header-based auth)",
  });

  app.openAPIRegistry.registerComponent("securitySchemes", "cookieAuth", {
    type: "apiKey",
    in: "cookie",
    name: "accessToken",
    description: "JWT access token is automatically read from the `accessToken` HttpOnly cookie",
  });
  app.doc("/docs-json", {
    openapi: "3.0.0",
    info: {
      version: config.version,
      title: config.title,
    },
  });

  app.get(
    "/docs",
    Scalar(() => {
      return {
        url: "/docs-json",
        authentication: {
          preferredSecurityScheme: "bearerAuth",
        },
      };
    }),
  );

  logger.info("Docs available at /docs", {
    module: "system",
    action: "configure",
  });
}
