import { rateLimiter } from "hono-rate-limiter";
import { StatusCodes } from "@repo/config";

// Global rate limiter - applies to all routes
export const globalRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: "draft-6", // Set `RateLimit` and `RateLimit-Policy` headers
  keyGenerator: (c) => c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown",
  handler: (c) => {
    return c.json(
      {
        message: "Too many requests, please try again later.",
      },
      StatusCodes.HTTP_429_TOO_MANY_REQUESTS,
    );
  },
});

// Strict rate limiter for sensitive endpoints (OAuth, login, etc.)
export const strictRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // Limit each IP to 10 requests per windowMs
  standardHeaders: "draft-6",
  keyGenerator: (c) => c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown",
  handler: (c) => {
    return c.json(
      {
        message: "Too many requests, please try again later.",
      },
      StatusCodes.HTTP_429_TOO_MANY_REQUESTS,
    );
  },
});

// Auth rate limiter for authentication routes
export const authRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // Limit each IP to 20 auth requests per windowMs
  standardHeaders: "draft-6",
  keyGenerator: (c) => c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown",
  handler: (c) => {
    return c.json(
      {
        message: "Too many authentication attempts, please try again later.",
      },
      StatusCodes.HTTP_429_TOO_MANY_REQUESTS,
    );
  },
});
