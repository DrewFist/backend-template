import { factory, customZValidator, logger } from "@repo/shared";
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "@repo/config";
import { z } from "zod";
import { TokenService } from "../services";

export const postRefreshTokenHandler = factory.createHandlers(
  customZValidator(
    "json",
    z.object({
      sessionId: z.string({ message: "Session ID is required" }),
    }),
  ),
  async (c) => {
    try {
      const { sessionId } = c.req.valid("json");

      // Refresh access token
      const result = await TokenService.refreshAccessToken(sessionId);

      logger.audit("Access token refreshed", {
        module: "auth",
        action: "token:refresh:success",
        sessionId,
      });

      return c.json({
        message: "Token refreshed successfully",
        payload: {
          accessToken: result.accessToken,
          accessTokenExpiresAt: result.accessTokenExpiresAt.toISOString(),
          ...(result.refreshToken && {
            refreshToken: result.refreshToken,
            refreshTokenExpiresAt: result.refreshTokenExpiresAt?.toISOString(),
          }),
        },
      });
    } catch (err) {
      if (err instanceof HTTPException) {
        throw err;
      }

      logger.error("Error refreshing token", {
        module: "auth",
        action: "token:refresh:error",
        error: err instanceof Error ? err.message : String(err),
      });

      // Check for specific error messages
      if (err instanceof Error) {
        if (err.message.includes("Session not found")) {
          throw new HTTPException(StatusCodes.HTTP_404_NOT_FOUND, {
            message: "Session not found",
            res: c.json({
              message: "Session not found",
            }),
          });
        }

        if (err.message.includes("Refresh token expired") || err.message.includes("not active")) {
          throw new HTTPException(StatusCodes.HTTP_401_UNAUTHORIZED, {
            message: "Session expired. Please re-authenticate.",
            res: c.json({
              message: "Session expired. Please re-authenticate.",
            }),
          });
        }
      }

      throw new HTTPException(StatusCodes.HTTP_500_INTERNAL_SERVER_ERROR, {
        message: "Internal Server Error",
        res: c.json({
          message: "Internal Server Error",
        }),
      });
    }
  },
);
