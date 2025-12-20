import { factory, customZValidator, verifyJwt, signJwt, logger } from "@repo/shared";
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "@repo/config";
import { z } from "zod";
import { OAuthService } from "../services";
import { SessionProvider } from "@repo/db";
import { oauthProviderFactory } from "../providers";

export const getOauthCallbackHandler = factory.createHandlers(
  customZValidator(
    "param",
    z.object({
      provider: z.nativeEnum(SessionProvider, {
        message: "Invalid OAuth provider",
      }),
    }),
  ),
  customZValidator(
    "query",
    z.object({
      code: z.string({ message: "Please enter a valid code" }).optional(),
      error: z.string().optional(),
      error_description: z.string().optional(),
      state: z.string({ message: "State parameter is required for CSRF protection" }).optional(),
    }),
  ),
  async (c) => {
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
    try {
      const decodedState = verifyJwt(state, {
        algorithms: ["HS256"],
      }) as { state: string };

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

      // State token is valid - this confirms the request is legitimate and not a CSRF attack
    } catch (err) {
      if (err instanceof HTTPException) {
        throw err;
      }

      // JWT verification failed (expired, invalid signature, etc.)
      logger.error("State token validation failed", {
        module: "auth",
        action: "oauth:callback:state_validation_failed",
        provider,
        error: err instanceof Error ? err.message : String(err),
      });

      throw new HTTPException(StatusCodes.HTTP_400_BAD_REQUEST, {
        message: "State token is invalid or expired. Please try again.",
        res: c.json({
          message: "State token is invalid or expired. Please try again.",
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
        {
          expiresIn: "1h",
        },
      );

      const serverRefreshToken = signJwt(
        {
          userId: user.id,
          sessionId: session.id,
        },
        {
          expiresIn: "90d",
        },
      );

      return c.json({
        message: "Logged in successfully",
        payload: {
          accessToken: serverAccessToken,
          refreshToken: serverRefreshToken,
        },
      });
    } catch (err) {
      if (err instanceof HTTPException) {
        if (err.status >= 400 && err.status < 500) {
          logger.error(`OAuth authentication failed for ${provider}`, {
            module: "auth",
            action: "oauth:authentication:failed",
            provider,
            status: err.status,
            message: err.message,
          });
        }
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
  },
);
