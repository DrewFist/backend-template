import { env } from "@repo/config";
import { serve, ServerType } from "@hono/node-server";
import { cors } from "hono/cors";
import packageJson from "../package.json";
import { configureOpenAPI, createApp, logger, globalRateLimiter } from "@repo/shared";
import { closeDB, connectDB } from "@repo/db";
import authRoutes from "./modules/auth/auth.routes";

const app = createApp();

// CORS configuration
const allowedOrigins =
  env.CORS_ORIGIN === "*" ? "*" : env.CORS_ORIGIN.split(",").map((origin) => origin.trim());

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
    server = serve({
      fetch: app.fetch,
      port: +env.PORT,
    });
    logger.info(`Server running on port ${env.PORT}`, {
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

let server: ServerType;
start();

// Stop server
async function stop() {
  const shutdownTimeout = setTimeout(() => {
    logger.error("Shutdown timeout reached, forcing exit", {
      module: "system",
      action: "shutdown",
    });
    process.exit(1);
  }, 10_000); // Increased to 10s for Resource close reliability

  try {
    // Clear resources
    await closeDB();
    // await closeRedis()
  } catch (error) {
    logger.error("Failed to close DB", {
      module: "db",
      action: "shutdown",
      error: error,
    });
  }

  // Close server after resources
  server.close((err) => {
    if (err) {
      logger.error("Force closed server", {
        module: "system",
        action: "shutdown",
        error: err,
      });
    } else {
      logger.info("Server closed", {
        module: "system",
        action: "shutdown",
      });
    }
    clearTimeout(shutdownTimeout);
    process.exit(0);
  });
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
