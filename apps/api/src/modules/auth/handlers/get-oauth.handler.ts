import { generateStateToken, signJwt, errorResponseSchemas } from "@repo/shared";
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "@repo/config";
import { OAuthService } from "../services";
import { oauthProviderFactory } from "../providers";
import { createRoute, z } from "@hono/zod-openapi";
import { SessionProvider } from "@repo/db";
import { env } from "@/env";
import { type AppRouteHandler } from "@/types";

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
    query: z.object({
      redirect: z
        .string()
        .optional()
        .default("true")
        .openapi({
          description:
            "Wether to redirect to frontend app after OAuth authorization URL is generated",
          enum: ["true", "false"],
          example: "false",
          param: {
            in: "query",
            name: "redirect",
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
    ...errorResponseSchemas,
  },
});

export type GetOauthProviderRoute = typeof getOauthProviderRoute;

export const getOauthHandler: AppRouteHandler<GetOauthProviderRoute> = (c) => {
  const { provider } = c.req.valid("param");
  const { redirect } = c.req.valid("query");

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
  const signedState = signJwt({ state: stateToken, redirect: redirect }, env.JWT_SECRET, {
    expiresIn: "10m", // State should expire after 10 minutes
  });

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
