import { env } from "./src/env";
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "../../packages/db/src/schema/**/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
    ssl: env.NODE_ENV === "development" ? false : { rejectUnauthorized: false },
  },
  casing: "snake_case",
});
