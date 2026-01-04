import { createRouter, authRateLimiter } from "@repo/shared";
import { getOauthProviderRoute, getOauthHandler } from "./handlers/get-oauth.handler";
import {
  getOauthCallbackRoute,
  getOauthCallbackHandler,
} from "./handlers/get-oauth-callback.handler";
import {
  postRefreshTokenRoute,
  postRefreshTokenHandler,
} from "./handlers/post-refresh-token.handler";
import { type AppBindings } from "../../types";
import { getMeHandler, getMeRoute } from "./handlers/get-me.handler";

const authRoutes = createRouter<AppBindings>();

// Apply auth-specific rate limiting
authRoutes.use(authRateLimiter);

// Register routes - each handler defines its own OpenAPI schema
authRoutes.openapi(getOauthProviderRoute, getOauthHandler);
authRoutes.openapi(getOauthCallbackRoute, getOauthCallbackHandler);
authRoutes.openapi(postRefreshTokenRoute, postRefreshTokenHandler);
authRoutes.openapi(getMeRoute, getMeHandler);

export default authRoutes;
