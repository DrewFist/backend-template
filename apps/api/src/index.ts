import { Hono } from "hono";
import apiV1Routes from "@/api/v1";
import { connectDB } from "@repo/db";
import { logger } from "@repo/shared";
import { env } from "@repo/config";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";

const app = new Hono();

app.use(cors({ origin: "*" }));

app.get("/health", (c) => {
  return c.json({
    message: "Server is up and running!!",
  });
});
app.route("/", apiV1Routes);

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
