import { env } from "@repo/config";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import packageJson from "../package.json";
import { configureOpenAPI, createApp, logger, globalRateLimiter } from "@repo/shared";
import { connectDB } from "@repo/db";
import authRoutes from "./modules/auth/auth.routes";

const app = createApp();

// CORS configuration
const allowedOrigins = env.CORS_ORIGIN === "*" 
  ? "*" 
  : env.CORS_ORIGIN.split(",").map(origin => origin.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length", "X-Request-Id"],
    maxAge: 86400,
  }),
);

// Apply global rate limiter
app.use(globalRateLimiter);

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
