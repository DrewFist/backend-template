import { StatusCodes } from "@repo/config";
import { logger, verifyJwt } from "@repo/shared";
import { type MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { env } from "@/env";
import { SessionService, UsersService } from "@repo/db";
import { getCookie } from "hono/cookie";
import { type AppBindings } from "../types";

/**
 * Extract user from access token and attach to context
 */
export const getUserMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  try {
    const authHeader = c.req.header("Authorization");
    const bearerToken = authHeader?.replace("Bearer ", "").trim();
    const accessToken =
      getCookie(c, "accessToken") || (bearerToken && bearerToken !== "Bearer" ? bearerToken : null);

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

      // get user details from user id from session
      const user = await UsersService.findById(decodedToken.userId);

      // attach user to context
      if (user) {
        c.set("user", user);
      }

      if (session) {
        c.set("session", session);
      }
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
