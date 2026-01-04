import { verifyJwt, signJwt, logger, errorResponseSchemas } from "@repo/shared";
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "@repo/config";
import { OAuthService } from "../services";
import { oauthProviderFactory } from "../providers";
import { createRoute, z } from "@hono/zod-openapi";
import { SessionProvider } from "@repo/db";
import { env } from "@/env";
import { type AppRouteHandler } from "@/types";
import { setCookie } from "hono/cookie";

export const getOauthCallbackRoute = createRoute({
  method: "get",
  path: "/v1/oauth/{provider}/callback",
  tags: ["OAuth"],
  summary: "OAuth provider callback",
  description: "Handles the OAuth callback from the provider and exchanges code for tokens",
  request: {
    params: z.object({
      provider: z
        .enum(SessionProvider, {
          message: "Invalid OAuth provider",
        })
        .openapi({
          description: "The OAuth provider to use (e.g., google, github)",
          example: SessionProvider.GOOGLE,
          param: {
            in: "path",
            name: "provider",
          },
        }),
    }),
    query: z.object({
      code: z
        .string({ message: "Please enter a valid code" })
        .optional()
        .openapi({
          description: "The authorization code returned by the OAuth provider",
          example: "4/0AX4XfWg...example_code...Xg",
          param: {
            in: "query",
            name: "code",
          },
        }),
      error: z
        .string()
        .optional()
        .openapi({
          description: "Error code returned by the OAuth provider, if any",
          example: "access_denied",
          param: {
            in: "query",
            name: "error",
          },
        }),
      error_description: z
        .string()
        .optional()
        .openapi({
          description: "Error description returned by the OAuth provider, if any",
          example: "The user denied access to the application.",
          param: {
            in: "query",
            name: "error_description",
          },
        }),
      state: z
        .string({ message: "State parameter is required for CSRF protection" })
        .optional()
        .openapi({
          description: "The state parameter returned by the OAuth provider for CSRF protection",
          example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...example_state...X0",
          param: {
            in: "query",
            name: "state",
          },
        }),
    }),
  },
  responses: {
    200: {
      description: "Successfully authenticated and tokens generated",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string().openapi({
              example: "Logged in successfully",
            }),
            payload: z.object({
              accessToken: z.string().openapi({
                description: "JWT access token for API authentication",
                example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
              }),
              refreshToken: z.string().openapi({
                description: "JWT refresh token for obtaining new access tokens",
                example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
              }),
            }),
          }),
        },
      },
    },
    [StatusCodes.HTTP_302_FOUND]: {
      description: "Redirect to app after successful authentication",
    },
    ...errorResponseSchemas,
  },
});

export type GetOauthCallbackRoute = typeof getOauthCallbackRoute;

export const getOauthCallbackHandler: AppRouteHandler<GetOauthCallbackRoute> = async (c) => {
  const { provider } = c.req.valid("param");
  const { code, error, error_description, state } = c.req.valid("query");

  // Check if provider is registered
  if (!oauthProviderFactory.hasProvider(provider)) {
    throw new HTTPException(StatusCodes.HTTP_400_BAD_REQUEST, {
      message: "OAuth provider not supported",
      res: c.json({
        message: `OAuth provider "${provider}" is not supported`,
      }),
    });
  }

  // Handle error/error_description query params from OAuth provider
  if (error) {
    logger.error(`OAuth error received from ${provider}`, {
      module: "auth",
      action: "oauth:callback:error",
      provider,
      error,
      error_description,
      state,
    });

    throw new HTTPException(StatusCodes.HTTP_400_BAD_REQUEST, {
      message: "OAuth authorization failed",
      res: c.json({
        message: "OAuth authorization failed",
        error: error_description || error,
      }),
    });
  }

  // Validate that code and state are present
  if (!code) {
    logger.error(`OAuth callback missing authorization code for ${provider}`, {
      module: "auth",
      action: "oauth:callback:missing_code",
      provider,
      state,
    });

    throw new HTTPException(StatusCodes.HTTP_400_BAD_REQUEST, {
      message: "Authorization code is required",
      res: c.json({
        message: "Authorization code is required",
      }),
    });
  }

  if (!state) {
    logger.error(`OAuth callback missing state parameter for ${provider}`, {
      module: "auth",
      action: "oauth:callback:missing_state",
      provider,
    });

    throw new HTTPException(StatusCodes.HTTP_400_BAD_REQUEST, {
      message: "State parameter is required for security",
      res: c.json({
        message: "State parameter is required for security",
      }),
    });
  }

  // Validate the state token to prevent CSRF attacks

  const decodedState = verifyJwt(state, env.JWT_SECRET, {
    algorithms: ["HS256"],
  }) as { state: string; redirect: "true" | "false" };

  if (!decodedState.state) {
    logger.error("Invalid state token structure", {
      module: "auth",
      action: "oauth:callback:invalid_state_structure",
      provider,
    });

    throw new HTTPException(StatusCodes.HTTP_400_BAD_REQUEST, {
      message: "Invalid state parameter",
      res: c.json({
        message: "Invalid state parameter",
      }),
    });
  }

  try {
    // Handle OAuth callback using the service
    const result = await OAuthService.handleCallback(provider, code);

    const { user, session } = result;

    // Log successful authentication
    logger.audit(`User authenticated via ${provider} OAuth`, {
      module: "auth",
      action: "oauth:authentication:success",
      provider,
      userId: user.id,
      email: user.email,
      providerAccountId: user.providerAccountId,
      sessionId: session.id,
    });

    // Generate server JWT tokens
    const serverAccessToken = signJwt(
      {
        userId: user.id,
        sessionId: session.id,
      },
      env.JWT_SECRET,
      {
        expiresIn: "1h",
      },
    );

    const serverRefreshToken = signJwt(
      {
        userId: user.id,
        sessionId: session.id,
      },
      env.JWT_SECRET,
      {
        expiresIn: "90d",
      },
    );

    if (decodedState.redirect === "false") {
      return c.json({
        message: "Logged in successfully",
        payload: {
          accessToken: serverAccessToken,
          refreshToken: serverRefreshToken,
        },
      });
    } else {
      setCookie(c, "refresh_token", serverRefreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 90 * 24 * 60 * 60, // 90 days in seconds
      });

      setCookie(c, "access_token", serverAccessToken, {
        httpOnly: false,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60, // 1 hour in seconds
      });

      return c.redirect(env.FRONTEND_URL);
    }
  } catch (err: any) {
    if (err instanceof HTTPException) {
      throw err;
    }

    logger.error(`Unexpected error during OAuth callback for ${provider}`, {
      module: "auth",
      action: "oauth:callback:error",
      provider,
      error: err,
    });

    throw new HTTPException(StatusCodes.HTTP_500_INTERNAL_SERVER_ERROR, {
      message: "Internal Server Error",
      res: c.json({
        message: "Internal Server Error",
      }),
    });
  }
};
