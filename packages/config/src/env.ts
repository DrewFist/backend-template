import { z } from "zod";

/**
 * Base environment schema for shared packages
 * Apps should extend this with their own specific variables
 */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).optional().default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .optional()
    .default("info"),
  LOKI_HOST: z.string().optional().default("http://localhost:3100"),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;

/**
 * Parse base environment variables
 * This is used by shared packages
 */
export const baseEnv = baseEnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  LOG_LEVEL: process.env.LOG_LEVEL,
  LOKI_HOST: process.env.LOKI_HOST,
});
