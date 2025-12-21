# AI Coding Agent Instructions

## Project Overview

This is a **Turborepo monorepo** with **Bun + Hono + TypeScript + PostgreSQL + Drizzle ORM** services. The main API service (`apps/api`) provides OAuth authentication. Runtime: Bun (not Node.js).

## Monorepo Structure

- `apps/api/` - Main API service with OAuth and HTTP endpoints
- `packages/shared/` - Shared types, utilities, and constants across services
- `packages/db/` - Shared database package with schemas, services, and connection utilities
- `turbo.json` - Turborepo task configuration (build, dev, db commands)
- Root `package.json` - Workspace configuration with `workspaces: ["apps/*", "packages/*"]`

**Adding new services**: Create `apps/{service}` with `package.json` containing `"name": "@repo/{service}"`. Add dependencies: `"@repo/shared": "workspace:*"` and `"@repo/db": "workspace:*"`. Run `bun install` to link workspaces.

## Architecture Patterns

### Module Structure (API Service)

- **Modular feature organization**: Each feature lives in `apps/api/src/modules/{feature}/` with subdirectories:
  - `{feature}.routes.ts` - Hono router configuration
  - `handlers/` - Request handlers (use Hono's factory pattern)
  - `services/` - Business logic
  - `providers/` - External integrations (e.g., OAuth providers)

Example: `apps/api/src/modules/auth/` contains `auth.routes.ts`, `handlers/get-oauth.handler.ts`, `providers/google.provider.ts`

### Handler Pattern

**Always use the RouteHandler pattern** with colocated route definitions:

```typescript
import { createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import { StatusCodes, errorResponseSchemas } from "@repo/config";

// Define route with OpenAPI schema
export const myRoute = createRoute({
  method: "get",
  path: "/resource",
  tags: ["Resource"],
  summary: "Get resource",
  request: {
    query: z.object({ id: z.string() }),
  },
  responses: {
    [StatusCodes.HTTP_200_OK]: {
      content: { "application/json": { schema: z.object({ data: z.any() }) } },
      description: "Success",
    },
    ...errorResponseSchemas,
  },
});

// Implement handler with type safety
export const myHandler: RouteHandler<typeof myRoute> = async (c) => {
  const { id } = c.req.valid("query");
  return c.json({ data: {} }, StatusCodes.HTTP_200_OK);
};
```

### Database Patterns

1. **Shared database package**: Database code lives in `packages/db/src/`

   - `connection.ts` - Database connection management (use `initializeDB()` before `connectDB()`)
   - `schema/{domain}/` - Drizzle ORM table schemas
   - `services/{domain}.service.ts` - CRUD operations organized by domain

2. **Using the database**:

   ```typescript
   import { initializeDB, connectDB, UsersService, SessionService } from "@repo/db";

   // Initialize with config (in app startup)
   initializeDB({
     connectionString: env.DATABASE_URL,
     ssl: env.NODE_ENV === "development" ? false : { rejectUnauthorized: false },
   });
   await connectDB();

   // Use services with optional logger
   const user = await UsersService.create(payload, logger, { tx });
   ```

3. **Casing**: Drizzle uses `snake_case` for DB columns (configured in `apps/api/drizzle.config.ts`)

4. **Service namespace pattern**: Services use namespace exports with optional logger parameter:

   ```typescript
   export namespace UsersService {
     export async function create(
       payload: NewUser,
       logger?: {
         audit: (msg: string, meta: any) => void;
         error: (msg: string, meta: any) => void;
       },
       options?: { tx?: DBTransaction },
     ) {
       const queryClient = options?.tx || db;
       return queryClient.insert(usersTable).values(payload).returning();
     }
   }
   ```

5. **Transaction support**: Services accept optional `tx` parameter for transaction support

### Validation & Error Handling

- **Define validation in route schema** using Zod:
  ```typescript
  request: {
    query: z.object({ provider: z.nativeEnum(SessionProvider) }),
  }
  ```
- **Global error handling** via `createApp()` with `defaultHook` for validation errors
- **Throw errors** with `HTTPException` and `StatusCodes`:
  ```typescript
  throw new HTTPException(StatusCodes.HTTP_400_BAD_REQUEST, {
    res: c.json({ message: "Error message" }),
  });
  ```
- **Always include error schemas** in route responses:
  ```typescript
  import { errorResponseSchemas } from "@repo/config";
  responses: {
    [StatusCodes.HTTP_200_OK]: { /* ... */ },
    ...errorResponseSchemas,  // 400, 401, 403, 404, 429, 500
  }
  ```

### OAuth Architecture

**Provider factory pattern** at `apps/api/src/modules/auth/providers/`:

- All providers implement `OAuthProvider` interface from `base.provider.ts`
- Registered in `oauthProviderFactory` (see `providers/index.ts`)
- Routes are generic: `/oauth/:provider` and `/oauth/:provider/callback`
- To add a new provider: implement `OAuthProvider`, register in factory

### Security Patterns

1. **Encryption**: Use `encrypt()`/`decrypt()` from `@/lib/encryption` for sensitive data (refresh tokens). Uses AES-256-GCM.
2. **JWT**: Use `signJwt()`/`verifyJwt()` from `@/lib/jwt` for tokens
3. **CSRF protection**: OAuth uses signed state tokens (10min expiry)

### Logging

**Structured logging** with Winston (`@/lib/logger`):

```typescript
logger.info("message", { module: "auth", action: "oauth:callback", userId: "123" });
logger.error("error", { module: "db", action: "query", error: err });
logger.audit("sensitive action", { module: "users", action: "service:create" });
```

Modules: `"db" | "auth" | "users" | "system" | "session" | "security"`

### Rate Limiting

**Three tiers** available in `packages/shared/src/rate-limiter.ts`:

1. **globalRateLimiter**: 100 requests per 15 minutes (applied to entire app)
2. **authRateLimiter**: 20 requests per 15 minutes (for auth routes)
3. **strictRateLimiter**: 10 requests per 15 minutes (for sensitive operations)

Apply to routes:

```typescript
const router = createRouter().use(authRateLimiter).openapi(route, handler);
```

### CORS Configuration

**Environment-based** CORS in `apps/api/src/index.ts`:

- Uses `CORS_ORIGIN` env var (comma-separated or `*`)
- Credentials support enabled
- Configurable allowed headers and methods

### OpenAPI Documentation

- **Scalar UI** at `/docs` endpoint
- Configured via `configureOpenAPI()` from `@repo/shared`
- Routes defined with `createRoute()` from `@hono/zod-openapi`
- Registered with `.openapi(route, handler)` on OpenAPIHono router

## Environment & Configuration

- **Env validation**: All env vars in `packages/config/src/env.ts` with Zod schemas
- **Path aliases**: Use `@/*` for `src/*` (configured in `apps/api/tsconfig.json`)
- **Status codes**: Import `StatusCodes` from `@repo/config` (never hardcode)
- **Error schemas**: Import `errorResponseSchemas` from `@repo/config`
- **Shared packages**: Import from `@repo/shared` for utilities, error handling, rate limiting
- **Database package**: Import from `@repo/db` for database schemas, services, and types

## Development Workflows

### Running Services

```bash
bun run dev                      # Run all services with Turborepo
bun run dev --filter=@repo/api   # Run specific service
```

### Database Migrations

```bash
bun run db:generate              # Generate migrations (runs in all apps with drizzle.config.ts)
bun run db:migrate               # Apply migrations (runs in all apps)
```

**Note**: Drizzle config in `apps/api/drizzle.config.ts` points to `packages/db/src/schema/**/*.ts`

### Local PostgreSQL

```bash
cd apps/api
docker compose -f docker-compose.dev.yml up -d
```

Database: `backend-template` on port 5432

## Key Files to Reference

- [apps/api/src/modules/auth/auth.routes.ts](apps/api/src/modules/auth/auth.routes.ts) - Route registration pattern
- [apps/api/src/modules/auth/handlers/get-oauth.handler.ts](apps/api/src/modules/auth/handlers/get-oauth.handler.ts) - RouteHandler pattern example
- [apps/api/src/modules/auth/providers/base.provider.ts](apps/api/src/modules/auth/providers/base.provider.ts) - Provider interface
- [packages/db/src/connection.ts](packages/db/src/connection.ts) - DB setup with transaction types
- [packages/db/src/services/users.service.ts](packages/db/src/services/users.service.ts) - Service namespace pattern
- [packages/shared/src/create-app.ts](packages/shared/src/create-app.ts) - App factory with error handling
- [packages/shared/src/error-schemas.ts](packages/shared/src/error-schemas.ts) - OpenAPI error schemas
- [packages/shared/src/rate-limiter.ts](packages/shared/src/rate-limiter.ts) - Rate limiting configurations
- [packages/shared/src/middlewares/custom-z-validator.ts](packages/shared/src/middlewares/custom-z-validator.ts) - Validation wrapper

## Project-Specific Conventions

1. **Route definitions colocated with handlers** - export both `route` and `handler` from same file
2. **Routes file simplified** - just imports and registrations, no duplicate schemas
3. **Use RouteHandler<typeof route>** for type-safe handlers
4. **Always use StatusCodes enum** - import from `@repo/config`, never hardcode numbers
5. **Always include errorResponseSchemas** in route responses
6. **Soft deletes**: Tables use `deletedAt` timestamp pattern
7. **All timestamps** use `{ withTimezone: true }`
8. **Service errors**: Always pass logger to db services and log with module/action metadata
9. **Route versioning**: All routes under `/v1/` prefix
10. **OpenAPI documentation**: All routes must have proper OpenAPI schemas
11. **Rate limiting**: Apply appropriate limiter (global/auth/strict) to routes
12. **No block comments** in code (// ===== Section =====)
