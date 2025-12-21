import { OpenAPIHono } from "@hono/zod-openapi";
import { requestId } from "hono/request-id";

export function createRouter() {
  return new OpenAPIHono({
    strict: false,
  });
}

export function createApp() {
  const app = createRouter();
  app.use(requestId());

  return app;
}
