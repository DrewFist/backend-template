import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string({ message: "DATABASE_URL is required" }),
  PORT: z.string({ message: "PORT is required" }).optional().default("8000"),
  NODE_ENV: z
    .enum(["development", "staging", "production"], { message: "NODE_ENV is required" })
    .optional()
    .default("development"),
  GOOGLE_CLIENT_ID: z.string({ message: "GOOGLE_CLIENT_ID is required" }),
  GOOGLE_CLIENT_SECRET: z.string({ message: "GOOGLE_CLIENT_SECRET is required" }),
  GOOGLE_REDIRECT_URI: z.string({ message: "GOOGLE_REDIRECT_URI is required" }),
  ENCRYPTION_KEY: z.string({ message: "ENCRYPTION_KEY is required" }).refine(
    (val) => {
      // AES-256-GCM requires a 32-byte (256-bit) key
      // Hex encoded means 64 characters (32 bytes * 2)
      return /^[0-9a-fA-F]{64}$/.test(val);
    },
    {
      message: "ENCRYPTION_KEY must be a 64-character hexadecimal string (32 bytes for AES-256)",
    },
  ),
  JWT_SECRET: z
    .string({ message: "JWT_SECRET is required" })
    .min(32, { message: "JWT_SECRET must be at least 32 characters long for security" }),
});

const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  JWT_SECRET: process.env.JWT_SECRET,
});

export default env;
