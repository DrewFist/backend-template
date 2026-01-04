import { createRoute, z } from "@hono/zod-openapi";
import { enforceUserMiddleware } from "@/middlewares/enforce-user.middleware";
import { enforceRoleMiddleware } from "@/middlewares/enforce-role.middleware";
import { UserRole, UsersService } from "@repo/db";
import { errorResponseSchemas, logger } from "@repo/shared";
import type { AppRouteHandler } from "@/types";
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "@repo/config";

export const getAllUsersRoute = createRoute({
  method: "get",
  middleware: [enforceUserMiddleware, enforceRoleMiddleware(UserRole.ADMIN)],
  path: "/v1/users",
  tags: ["Users"],
  summary: "Get all users",
  description: "Retrieves a list of all users in the system",
  request: {
    query: z.object({
      page: z.number().optional().default(1).openapi({ example: 1, description: "Page number" }),
      limit: z
        .number()
        .optional()
        .default(10)
        .openapi({ example: 10, description: "Number of users per page" }),
    }),
  },
  responses: {
    200: {
      description: "Successfully retrieved the list of users",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string().openapi({ example: "Users retrieved successfully" }),
            payload: z.array(
              z.object({
                id: z.string().openapi({ example: "123e4567-e89b-12d3-a456-426614174000" }),
                email: z.email().openapi({ example: "user@example.com" }),
                firstName: z.string().openapi({ example: "John" }),
                lastName: z.string().nullable().openapi({ example: "Doe" }),
                role: z.enum(UserRole).openapi({ example: UserRole.USER }),
                avatar: z
                  .string()
                  .nullable()
                  .openapi({ example: "https://example.com/avatar.png" }),
              }),
            ),
          }),
        },
      },
    },
    ...errorResponseSchemas,
  },
});

export type GetAllUsersRoute = typeof getAllUsersRoute;

export const getAllUsersHandler: AppRouteHandler<GetAllUsersRoute> = async (c) => {
  const { page, limit } = c.req.valid("query");

  try {
    const users = await UsersService.findAll({ page, limit });

    return c.json({
      message: "Users retrieved successfully",
      payload: users,
    });
  } catch (err) {
    if (err instanceof HTTPException) {
      throw err;
    }

    logger.error("Error getting all users", {
      module: "users",
      action: "getAllUsersHandler",
      error: err,
    });

    throw new HTTPException(StatusCodes.HTTP_500_INTERNAL_SERVER_ERROR, {
      res: c.json({ message: "Internal Server Error" }, StatusCodes.HTTP_500_INTERNAL_SERVER_ERROR),
    });
  }
};
