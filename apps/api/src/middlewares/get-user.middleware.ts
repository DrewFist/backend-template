import { StatusCodes } from "@repo/config";
import { logger, verifyJwt } from "@repo/shared";
import { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { env } from "@/env";
import { SessionService, UsersService } from "@repo/db";
import { getCookie } from "hono/cookie";

/**
 * Extract user from access token and attach to context
 */
export const getUserMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    const accessToken =
      getCookie(c, "access_token") || c.req.header("Authorization")?.replace("Bearer ", "");

    if (accessToken) {
      // verify access token
      const decodedToken = verifyJwt<{ userId: string; sessionId: string }>(
        accessToken,
        env.JWT_SECRET,
      );

      // if decoded token is invalid, throw error
      if (!decodedToken || !decodedToken.userId || !decodedToken.sessionId) {
        throw new HTTPException(StatusCodes.HTTP_401_UNAUTHORIZED, {
          message: "Invalid access token",
          res: c.json({ message: "Invalid access token" }, StatusCodes.HTTP_401_UNAUTHORIZED),
        });
      }

      // check if session is valid and it's not revoked or expired
      const session = await SessionService.findById(decodedToken.sessionId);

      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        throw new HTTPException(StatusCodes.HTTP_401_UNAUTHORIZED, {
          message: "Session is invalid or expired",
          res: c.json(
            { message: "Session is invalid or expired" },
            StatusCodes.HTTP_401_UNAUTHORIZED,
          ),
        });
      }

      // get user details from user id from session
      const user = await UsersService.findById(decodedToken.userId);

      if (!user) {
        throw new HTTPException(StatusCodes.HTTP_401_UNAUTHORIZED, {
          message: "User not found",
          res: c.json({ message: "User not found" }, StatusCodes.HTTP_401_UNAUTHORIZED),
        });
      }

      // attach user to context
      c.set("user", user);
      c.set("session", session);
    }

    return next();
  } catch (err) {
    if (err instanceof HTTPException) {
      throw err;
    }

    logger.error("Error in getUserMiddleware:", {
      action: "getUserMiddleware",
      error: err,
      module: "users",
    });

    return c.json({ message: "Internal Server Error" }, StatusCodes.HTTP_500_INTERNAL_SERVER_ERROR);
  }
};
