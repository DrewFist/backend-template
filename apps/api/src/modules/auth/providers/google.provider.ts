import { env } from "@/env";
import { type OAuthProvider, type OAuthTokenResponse, type OAuthUserInfo } from "./base.provider";
import { logger } from "@repo/shared";

export class GoogleOAuthProvider implements OAuthProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly defaultScopes: string[];

  constructor() {
    this.clientId = env.GOOGLE_CLIENT_ID;
    this.clientSecret = env.GOOGLE_CLIENT_SECRET;
    this.redirectUri = env.GOOGLE_REDIRECT_URI;
    this.defaultScopes = ["openid", "email", "profile"];
  }

  getName(): string {
    return "google";
  }

  getDefaultScopes(): string[] {
    return this.defaultScopes;
  }

  getTokenEndpoint(): string {
    return "https://oauth2.googleapis.com/token";
  }

  getUserInfoEndpoint(): string {
    return "https://www.googleapis.com/oauth2/v2/userinfo";
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: this.defaultScopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
    try {
      const response = await fetch(this.getTokenEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as {
          error?: string;
          error_description?: string;
        };

        logger.error("Failed to exchange Google OAuth code for token", {
          module: "auth",
          action: "oauth:google:exchange_code",
          status: response.status,
          error: errorData.error,
          error_description: errorData.error_description,
        });

        throw new Error(
          `Token exchange failed: ${errorData.error_description || errorData.error || "Unknown error"}`,
        );
      }

      const tokenData = (await response.json()) as OAuthTokenResponse;

      if (!tokenData.access_token) {
        throw new Error("Token response missing access_token");
      }

      return tokenData;
    } catch (err) {
      logger.error("Error exchanging Google OAuth code", {
        module: "auth",
        action: "oauth:google:exchange_code",
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse> {
    try {
      const response = await fetch(this.getTokenEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as {
          error?: string;
          error_description?: string;
        };

        logger.error("Failed to refresh Google OAuth token", {
          module: "auth",
          action: "oauth:google:refresh_token",
          status: response.status,
          error: errorData.error,
          error_description: errorData.error_description,
        });

        throw new Error(
          `Token refresh failed: ${errorData.error_description || errorData.error || "Unknown error"}`,
        );
      }

      const tokenData = (await response.json()) as OAuthTokenResponse;

      if (!tokenData.access_token) {
        throw new Error("Token response missing access_token");
      }

      // Google doesn't always return a new refresh token on refresh
      // If it's not provided, we keep using the old one
      return tokenData;
    } catch (err) {
      logger.error("Error refreshing Google OAuth token", {
        module: "auth",
        action: "oauth:google:refresh_token",
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    try {
      const response = await fetch(this.getUserInfoEndpoint(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = (await response.json()) as {
          error?: string;
          error_description?: string;
        };

        logger.error("Failed to fetch Google user info", {
          module: "auth",
          action: "oauth:google:get_user_info",
          status: response.status,
          error: errorData.error,
          error_description: errorData.error_description,
        });

        throw new Error(
          `Failed to fetch user info: ${errorData.error_description || errorData.error || "Unknown error"}`,
        );
      }

      const userData = (await response.json()) as {
        id: string;
        email: string;
        verified_email: boolean;
        name?: string;
        given_name?: string;
        family_name?: string;
        picture?: string;
      };

      if (!userData.id || !userData.email) {
        throw new Error("User info response missing required fields (id, email)");
      }

      return {
        id: userData.id,
        email: userData.email,
        email_verified: userData.verified_email,
        name: userData.name,
        given_name: userData.given_name,
        family_name: userData.family_name,
        picture: userData.picture,
      };
    } catch (err) {
      logger.error("Error fetching Google user info", {
        module: "auth",
        action: "oauth:google:get_user_info",
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}
