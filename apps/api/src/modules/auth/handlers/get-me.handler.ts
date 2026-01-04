import { createRoute, z } from "@hono/zod-openapi";
import { StatusCodes } from "@repo/config";
import { errorResponseSchemas, logger } from "@repo/shared";
import { type AppRouteHandler } from "../../../types";
import { enforceUserMiddleware } from "../../../middlewares/enforce-user.middleware";
import { HTTPException } from "hono/http-exception";
import { UserRole } from "@repo/db/src/schema/users/users.db";

export const getMeRoute = createRoute({
  method: "get",
  path: "/v1/auth/me",
  tags: ["Auth"],
  summary: "Get current authenticated user",
  description: "Retrieves the details of the currently authenticated user",
  middleware: [enforceUserMiddleware],
  responses: {
    200: {
      description: "Successfully retrieved the authenticated user",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string().openapi({
              example: "User retrieved successfully",
            }),
            payload: z.object({
              user: z.object({
                email: z.email().openapi({ example: "hey@ayushchugh.com" }),
                firstName: z.string().openapi({ example: "Ayush" }),
                lastName: z.string().nullable().openapi({ example: "Chugh" }),
                role: z.enum(UserRole).openapi({ example: UserRole.USER }),
                avatar: z
                  .string()
                  .nullable()
                  .openapi({ example: "https://example.com/avatar.png" }),
              }),
            }),
          }),
        },
      },
    },
    ...errorResponseSchemas,
  },
});

export type GetMeRoute = typeof getMeRoute;

export const getMeHandler: AppRouteHandler<GetMeRoute> = (c) => {
  const user = c.var.user;

  try {
    return c.json({
      message: "User retrieved successfully",
      payload: {
        user: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          avatar: user.avatar,
        },
      },
    });
  } catch (err) {
    if (err instanceof HTTPException) {
      throw err;
    }

    logger.error("Error getting authenticated user", {
      module: "auth",
      action: "getMeHandler",
      error: err,
    });

    throw new HTTPException(StatusCodes.HTTP_500_INTERNAL_SERVER_ERROR, {
      message: "Internal Server Error",
      res: c.json({ message: "Internal Server Error" }, StatusCodes.HTTP_500_INTERNAL_SERVER_ERROR),
    });
  }
};
