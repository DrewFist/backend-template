import type { z } from "zod";
import { zValidator as zv } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import type { ValidationTargets } from "hono/types";
import { StatusCodes } from "@repo/config";
import { factory } from "../factory";

/**
 * A wrapper around Hono's zValidator that formats errors in our custom format
 */
export function customZValidator<T extends z.ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return factory.createMiddleware(
    zv(target, schema, (result, c) => {
      if (!result.success) {
        const formatted: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const path = issue.path.join(".") || "_";
          formatted[path] = issue.message;
        }

        throw new HTTPException(StatusCodes.HTTP_400_BAD_REQUEST, {
          message: "Validation errors",
          res: c.json({ message: "Validation errors", errors: formatted }),
        });
      }
    }),
  );
}
