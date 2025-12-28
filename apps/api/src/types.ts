import { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import { Session, User } from "@repo/db";

/**
 * Application-wide Hono bindings that define context variables available in handlers.
 *
 * These bindings extend the default Hono context with typed variables that are
 * populated by middleware (e.g., authentication middleware sets `user` and `session`).
 *
 * @example
 * ```typescript
 * // Accessing bindings in a handler
 * const handler: AppRouteHandler<MyRoute> = (c) => {
 *   const user = c.get("user");    // Type: User
 *   const session = c.get("session"); // Type: Session
 *   return c.json({ userId: user.id });
 * };
 * ```
 */
export interface AppBindings {
  Variables: {
    /** The authenticated user, populated by auth middleware */
    user: User;
    /** The current session, populated by auth middleware */
    session: Session;
  };
}

/**
 * Type-safe route handler with application bindings.
 *
 * Use this type instead of `RouteHandler` from `@hono/zod-openapi` to get
 * proper typing for app-specific context variables (user, session).
 *
 * @template R - The route configuration type (created via `createRoute()`)
 *
 * @example
 * ```typescript
 * // 1. Define your route with createRoute()
 * export const myRoute = createRoute({
 *   method: "get",
 *   path: "/v1/resource/{id}",
 *   tags: ["Resource"],
 *   summary: "Get resource by ID",
 *   request: {
 *     params: z.object({ id: z.string() }),
 *   },
 *   responses: {
 *     [StatusCodes.HTTP_200_OK]: {
 *       content: { "application/json": { schema: responseSchema } },
 *       description: "Success",
 *     },
 *     ...errorResponseSchemas,
 *   },
 * });
 *
 * // 2. Export the route type for the handler
 * export type MyRoute = typeof myRoute;
 *
 * // 3. Create the handler with AppRouteHandler<RouteType>
 * export const myHandler: AppRouteHandler<MyRoute> = async (c) => {
 *   // Access validated params (use "param" not "params")
 *   const { id } = c.req.valid("param");
 *
 *   // Access query params if defined in route
 *   const { page } = c.req.valid("query");
 *
 *   // Access request body if defined in route
 *   const body = c.req.valid("json");
 *
 *   // Access authenticated user (from middleware)
 *   const user = c.get("user");
 *
 *   // Return typed response matching route definition
 *   return c.json({ data: result }, StatusCodes.HTTP_200_OK);
 * };
 *
 * // 4. Register in routes file
 * router.openapi(myRoute, myHandler);
 * ```
 *
 * @see {@link AppBindings} for available context variables
 * @see {@link https://hono.dev/docs/guides/middleware Hono Middleware} for adding variables to context
 */
export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>;
