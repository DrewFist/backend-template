import { Hono } from "hono";
import { getOauthHandler } from "@/modules/auth/handlers/get-oauth.handler";
import { getOauthCallbackHandler } from "@/modules/auth/handlers/get-oauth-callback.handler";
import { postRefreshTokenHandler } from "@/modules/auth/handlers/post-refresh-token.handler";

const authRoutes = new Hono();

// Generic OAuth routes - works with any provider (e.g., /oauth/google, /oauth/github)
// These routes accept provider as a path parameter
authRoutes.get("/oauth/:provider", ...getOauthHandler);
authRoutes.get("/oauth/:provider/callback", ...getOauthCallbackHandler);

// Token refresh endpoint
authRoutes.post("/oauth/refresh", ...postRefreshTokenHandler);

export default authRoutes;
