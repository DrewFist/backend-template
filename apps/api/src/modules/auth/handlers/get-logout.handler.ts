import { createRoute, z } from "@hono/zod-openapi";
import { errorResponseSchemas, logger } from "@repo/shared";
import { type AppRouteHandler } from "@/types";
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "@repo/config";
import { SessionService, SessionStatus } from "@repo/db";
import { deleteCookie } from "hono/cookie";
import { enforceUserMiddleware } from "@/middlewares/enforce-user.middleware";

export const getLogoutRoute = createRoute({
  method: "get",
  path: "/v1/auth/logout",
  tags: ["Auth"],
  summary: "Logout user",
  description: "Logs out the currently authenticated user by clearing their session",
  middleware: [enforceUserMiddleware],
  responses: {
    200: {
      description: "User logged out successfully",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
    ...errorResponseSchemas,
  },
});

export type GetLogoutRoute = typeof getLogoutRoute;

export const getLogoutHandler: AppRouteHandler<GetLogoutRoute> = async (c) => {
  const session = c.get("session");
  const user = c.get("user");

  if (!session || !user) {
    throw new HTTPException(StatusCodes.HTTP_401_UNAUTHORIZED, {
      message: "No active session found",
    });
  }

  try {
    await SessionService.updateById(session.id, {
      revokedAt: new Date(),
      status: SessionStatus.REVOKED,
    });

    deleteCookie(c, "accessToken");
    deleteCookie(c, "refreshToken");

    logger.audit("User logged out", {
      module: "auth",
      action: "logout",
      userId: user.id,
      sessionId: session.id,
    });

    return c.json({ message: "User logged out successfully" }, StatusCodes.HTTP_200_OK);
  } catch (err) {
    logger.error("Error logging out user", {
      action: "logout",
      module: "auth",
      error: err,
      userId: user.id,
    });

    throw new HTTPException(StatusCodes.HTTP_500_INTERNAL_SERVER_ERROR, {
      message: "An unexpected error occurred while logging out the user",
    });
  }
};
