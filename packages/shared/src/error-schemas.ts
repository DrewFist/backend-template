import { z } from "@hono/zod-openapi";
import { StatusCodes } from "@repo/config";

export const errorResponseSchemas = {
  [StatusCodes.HTTP_400_BAD_REQUEST]: {
    description: "Bad Request - Validation error or invalid input",
    content: {
      "application/json": {
        schema: z.object({
          message: z.string().openapi({
            example: "Validation failed",
          }),
          errors: z
            .record(z.string(), z.string())
            .optional()
            .openapi({
              example: {
                provider: "Invalid OAuth provider",
                email: "Email is required",
              },
            }),
        }),
      },
    },
  },
  [StatusCodes.HTTP_401_UNAUTHORIZED]: {
    description: "Unauthorized - Authentication required or invalid credentials",
    content: {
      "application/json": {
        schema: z.object({
          message: z.string().openapi({
            example: "Unauthorized access",
          }),
        }),
      },
    },
  },
  [StatusCodes.HTTP_403_FORBIDDEN]: {
    description: "Forbidden - Insufficient permissions",
    content: {
      "application/json": {
        schema: z.object({
          message: z.string().openapi({
            example: "Access forbidden",
          }),
        }),
      },
    },
  },
  [StatusCodes.HTTP_404_NOT_FOUND]: {
    description: "Not Found - Resource does not exist",
    content: {
      "application/json": {
        schema: z.object({
          message: z.string().openapi({
            example: "Resource not found",
          }),
        }),
      },
    },
  },
  [StatusCodes.HTTP_500_INTERNAL_SERVER_ERROR]: {
    description: "Internal Server Error - Unexpected server error",
    content: {
      "application/json": {
        schema: z.object({
          message: z.string().openapi({
            example: "Internal Server Error",
          }),
        }),
      },
    },
  },
};
