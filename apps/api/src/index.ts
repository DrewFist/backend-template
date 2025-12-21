import { env } from "@repo/config";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import packageJson from "../package.json";
import { configureOpenAPI, createApp, logger } from "@repo/shared";
import { connectDB } from "@repo/db";
import authRoutes from "./modules/auth/auth.routes";

const app = createApp();

app.use(cors({ origin: "*" }));

app.get("/health", (c) => {
  return c.json({
    message: "Server is up and running!!",
  });
});

const routes = [authRoutes] as const;

routes.forEach((route) => {
  app.route("/", route);
});

configureOpenAPI(app, {
  title: "API",
  version: packageJson.version,
});

// Start server
async function start() {
  try {
    await connectDB();
    const port = env.PORT;
    logger.info(`Server running on port ${port}`, {
      module: "system",
      action: "startup",
    });
  } catch (error) {
    logger.error("Failed to start server", {
      module: "system",
      action: "startup",
      error: error,
    });
    process.exit(1);
  }
}

void start();
serve({
  fetch: app.fetch,
  port: +env.PORT,
});
