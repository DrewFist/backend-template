import { factory, customZValidator, generateStateToken, signJwt } from "@repo/shared";
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "@repo/config";
import { z } from "zod";
import { OAuthService } from "../services";
import { SessionProvider } from "@repo/db";
import { oauthProviderFactory } from "../providers";

export const getOauthHandler = factory.createHandlers(
  customZValidator(
    "param",
    z.object({
      provider: z.nativeEnum(SessionProvider, {
        message: "Invalid OAuth provider",
      }),
    }),
  ),
  (c) => {
    try {
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
    } catch (err) {
      if (err instanceof HTTPException) {
        throw err;
      }

      throw new HTTPException(StatusCodes.HTTP_500_INTERNAL_SERVER_ERROR, {
        res: c.json({
          message: "Internal Server Error",
        }),
      });
    }
  },
);
