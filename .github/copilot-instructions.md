# AI Coding Agent Instructions

## Project Overview

**Turborepo monorepo** with **Bun + Hono + TypeScript + PostgreSQL + Drizzle ORM**. Runtime: **Bun** (not Node.js).

## Monorepo Structure

```
apps/api/           # Main API service (OAuth, HTTP endpoints)
packages/config/    # Environment validation (Zod), status codes
packages/db/        # Database schemas, services, connection
packages/shared/    # Utilities, middleware, logging, metrics
infra/monitoring/   # Prometheus, Grafana, Loki configs
```

**Adding new services**: Create `apps/{service}/package.json` with `"name": "@repo/{service}"`, add `"@repo/shared": "workspace:*"` and `"@repo/db": "workspace:*"`, run `bun install`.

## Module Structure

Features live in `apps/api/src/modules/{feature}/`:

- `{feature}.routes.ts` - Router with rate limiting applied
- `handlers/` - Request handlers (route + handler colocated)
- `services/` - Business logic
- `providers/` - External integrations (factory pattern)

## Handler Pattern (Critical)

**Always colocate route definition with handler**:

```typescript
// apps/api/src/modules/auth/handlers/get-oauth.handler.ts
import { createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import { StatusCodes } from "@repo/config";
import { errorResponseSchemas } from "@repo/shared";

export const myRoute = createRoute({
  method: "get",
  path: "/v1/resource/{id}",
  tags: ["Resource"],
  summary: "Get resource",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    [StatusCodes.HTTP_200_OK]: {
      content: { "application/json": { schema: z.object({ data: z.any() }) } },
      description: "Success",
    },
    ...errorResponseSchemas, // Always include - provides 400,401,403,404,429,500
  },
});

export const myHandler: RouteHandler<typeof myRoute> = async (c) => {
  const { id } = c.req.valid("param"); // "param" not "params"
  return c.json({ data: {} }, StatusCodes.HTTP_200_OK);
};
```

**Route registration** (keep minimal - just imports and `.openapi()` calls):

```typescript
// apps/api/src/modules/auth/auth.routes.ts
import { createRouter, authRateLimiter } from "@repo/shared";
import { myRoute, myHandler } from "./handlers/my.handler";

const router = createRouter();
router.use(authRateLimiter); // Apply rate limiting at route level
router.openapi(myRoute, myHandler);
export default router;
```

## Database Patterns

**Initialize before connecting** (in app startup):

```typescript
import { initializeDB, connectDB, UsersService } from "@repo/db";

initializeDB({ connectionString: env.DATABASE_URL, ssl: false });
await connectDB();
```

**Service namespace pattern** with optional transaction:

```typescript
// packages/db/src/services/users.service.ts
import { logger } from "@repo/shared";

export namespace UsersService {
  export async function create(payload: NewUser, options?: { tx?: DBTransaction }) {
    const queryClient = options?.tx || db;
    const [user] = await withMetrics("insert", "users", async () =>
      queryClient.insert(usersTable).values(payload).returning(),
    );
    logger.audit("User created", { module: "users", action: "service:create" });
    return user;
  }
}
```

**Soft deletes**: Tables use `deletedAt` timestamp - filter with `isNull(table.deletedAt)`

## Logging

Use structured logging with `logger` from `@repo/shared`:

```typescript
logger.info("message", { module: "auth", action: "oauth:callback", userId: "123" });
logger.error("error occurred", { module: "db", action: "query", error: err });
logger.audit("sensitive action", { module: "users", action: "service:create" });
```

Modules: `"db" | "auth" | "users" | "system" | "session" | "security" | "http"`

## Rate Limiting

Three tiers in `packages/shared/src/rate-limiter.ts`:

- `globalRateLimiter`: 1000 req/15min (applied globally in index.ts)
- `authRateLimiter`: 100 req/15min (for auth routes)
- `strictRateLimiter`: 50 req/15min (for sensitive operations)

## OAuth & Security

**Provider Factory Pattern** - Add new OAuth providers by implementing `OAuthProvider` interface:

```typescript
// apps/api/src/modules/auth/providers/base.provider.ts
interface OAuthProvider {
  getName(): string;
  getAuthorizationUrl(state: string): string;
  exchangeCodeForToken(code: string): Promise<OAuthTokenResponse>;
  refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse>;
  getUserInfo(accessToken: string): Promise<OAuthUserInfo>;
}

// Register in apps/api/src/modules/auth/providers/index.ts
this.register(SessionProvider.GITHUB, () => new GitHubOAuthProvider());
```

**CSRF Protection** - OAuth uses signed JWT state tokens (10min expiry):

```typescript
import { generateStateToken, signJwt, verifyJwt } from "@repo/shared";
const state = signJwt({ state: generateStateToken() }, env.JWT_SECRET, { expiresIn: "10m" });
```

**Encryption** - AES-256-GCM for sensitive data (refresh tokens):

```typescript
import { encrypt, decrypt } from "@repo/shared";
const encrypted = encrypt(refreshToken, env.ENCRYPTION_KEY); // Returns { data, iv, tag }
const decrypted = decrypt(encrypted.data, encrypted.iv, encrypted.tag, env.ENCRYPTION_KEY);
```

**JWT Tokens** - Use `signJwt()`/`verifyJwt()` from `@repo/shared` for access tokens.

## Metrics & Monitoring

**Stack**: Prometheus (metrics) + Grafana (dashboards) + Loki (logs)

**Accessing metrics**: `GET /metrics` endpoint (Prometheus format)

**HTTP Metrics** (auto-collected via `metricsMiddleware()`):

- `http_request_duration_seconds` - Request latency histogram
- `http_requests_total` - Request counter by method/route/status
- `http_errors_total` - Error counter

**Database Metrics** - Wrap queries with `withMetrics()`:

```typescript
import { withMetrics } from "@repo/db";
const [user] = await withMetrics("insert", "users", async () =>
  db.insert(usersTable).values(payload).returning(),
);
```

Tracked metrics:

- `db_query_duration_seconds` - Query latency by operation/table
- `db_connections_active` - Active connection count
- `db_errors_total` - Error counter by operation/type

**Domain-specific metrics** - Create in module (e.g., `auth.metrics.ts`):

```typescript
// apps/api/src/modules/auth/auth.metrics.ts
import { Counter } from "prom-client";

export const oauthEventsCounter = new Counter({
  name: "oauth_events_total",
  help: "Total number of OAuth events",
  labelNames: ["provider", "event_type"],
});

// Usage in handler
oauthEventsCounter.inc({ provider: "google", event_type: "login_success" });
```

**Grafana dashboards**: Pre-configured in `infra/monitoring/grafana/dashboards/`

## Error Handling

```typescript
import { HTTPException } from "hono/http-exception";
throw new HTTPException(StatusCodes.HTTP_400_BAD_REQUEST, {
  message: "Error description",
});
```

## Development Commands

```bash
bun run dev                      # Run all services
bun run dev --filter=@repo/api   # Run API only
bun run db:generate              # Generate migrations
bun run db:migrate               # Apply migrations
docker compose -f docker-compose.dev.yml up -d  # Start PostgreSQL + monitoring
```

## Key Files

- [apps/api/src/modules/auth/handlers/get-oauth.handler.ts](apps/api/src/modules/auth/handlers/get-oauth.handler.ts) - Handler pattern example
- [apps/api/src/modules/auth/auth.routes.ts](apps/api/src/modules/auth/auth.routes.ts) - Route registration
- [apps/api/src/modules/auth/providers/base.provider.ts](apps/api/src/modules/auth/providers/base.provider.ts) - OAuth provider interface
- [apps/api/src/modules/auth/providers/index.ts](apps/api/src/modules/auth/providers/index.ts) - Provider factory registration
- [apps/api/src/modules/auth/auth.metrics.ts](apps/api/src/modules/auth/auth.metrics.ts) - Domain metrics example
- [packages/db/src/services/users.service.ts](packages/db/src/services/users.service.ts) - Service namespace pattern
- [packages/db/src/connection.ts](packages/db/src/connection.ts) - DB initialization
- [packages/db/src/utils/metrics-wrapper.ts](packages/db/src/utils/metrics-wrapper.ts) - DB metrics wrapper
- [packages/shared/src/create-app.ts](packages/shared/src/create-app.ts) - App factory with validation hook
- [packages/shared/src/error-schemas.ts](packages/shared/src/error-schemas.ts) - OpenAPI error responses
- [packages/shared/src/encryption.ts](packages/shared/src/encryption.ts) - AES-256-GCM encryption

## Conventions

1. **Path params use `{param}`** in route path, access via `c.req.valid("param")`
2. **Always use `StatusCodes` enum** from `@repo/config` - never hardcode
3. **Always spread `...errorResponseSchemas`** in route responses
4. **All routes under `/v1/` prefix**
5. **Timestamps**: Always `{ withTimezone: true }`
6. **Casing**: Drizzle uses `snake_case` for DB columns
7. **Path aliases**: Use `@/*` for `src/*` in apps
