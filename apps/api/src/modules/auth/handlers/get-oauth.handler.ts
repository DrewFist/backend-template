import { generateStateToken, signJwt } from "@repo/shared";
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "@repo/config";
import { OAuthService } from "../services";
import { oauthProviderFactory } from "../providers";
import { RouteHandler, createRoute, z } from "@hono/zod-openapi";
import { SessionProvider } from "@repo/db";

export const getOauthProviderRoute = createRoute({
  method: "get",
  path: "/v1/oauth/{provider}",
  tags: ["Authentication"],
  summary: "Initiate OAuth authentication",
  description: "Generates and returns an OAuth authorization URL for the specified provider",
  request: {
    params: z.object({
      provider: z
        .nativeEnum(SessionProvider, {
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
  },
  responses: {
    200: {
      description: "OAuth authorization URL generated successfully",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string().openapi({
              example: "google OAuth link generated successfully",
            }),
            payload: z.object({
              link: z.string().url().openapi({
                description: "OAuth authorization URL to redirect the user to",
                example: "https://accounts.google.com/o/oauth2/v2/auth?...",
              }),
            }),
          }),
        },
      },
    },
    400: {
      description: "Invalid provider or provider not supported",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string().openapi({
              example: 'OAuth provider "invalid" is not supported',
            }),
            supportedProviders: z.array(z.string()).optional().openapi({
              example: ["google"],
            }),
          }),
        },
      },
    },
    500: {
      description: "Internal server error",
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
  },
});

export type GetOauthProviderRoute = typeof getOauthProviderRoute;

export const getOauthHandler: RouteHandler<GetOauthProviderRoute> = (c) => {
  const { provider } = c.req.valid("param");

  // Check if provider is registered
  if (!oauthProviderFactory.hasProvider(provider)) {
    throw new HTTPException(StatusCodes.HTTP_400_BAD_REQUEST, {
      message: "OAuth provider not supported",
      res: c.json({
        message: `OAuth provider "${provider}" is not supported`,
        supportedProviders: oauthProviderFactory.getRegisteredProviders(),
      }),
    });
  }

  // Generate state token for CSRF protection
  const stateToken = generateStateToken();

  // Sign the state token with JWT to enable server-side validation
  const signedState = signJwt(
    { state: stateToken },
    {
      expiresIn: "10m", // State should expire after 10 minutes
    },
  );

  // Get authorization URL from OAuth service
  const authorizationUrl = OAuthService.getAuthorizationUrl(provider, signedState);

  return c.json({
    message: `${provider} OAuth link generated successfully`,
    payload: {
      link: authorizationUrl,
      // Note: The state is in the OAuth URL. The provider will return it in the callback.
    },
  });
};
