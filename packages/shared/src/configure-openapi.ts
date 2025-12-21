import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { logger } from "./logger";

export function configureOpenAPI(
  app: OpenAPIHono,
  config: {
    title: string;
    version: string;
  },
) {
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
      };
    }),
  );

  logger.info("Docs available at /docs", {
    module: "system",
    action: "configure",
  });
}
