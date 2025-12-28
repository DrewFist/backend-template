# Architecture Guide

Overview of the monorepo structure, design patterns, and architectural decisions.

## Monorepo Structure

```
server-template/
├── apps/                          # Deployable applications
│   └── api/                       # Main API service
│
├── packages/                      # Shared packages
│   ├── config/                    # Environment & constants
│   ├── db/                        # Database layer
│   └── shared/                    # Utilities & middleware
│
├── infra/                         # Infrastructure configuration
│   └── monitoring/                # Prometheus, Grafana, Loki
│
├── docs/                          # Documentation
├── docker-compose.dev.yml         # Local development services
└── turbo.json                     # Turborepo configuration
```

## Package Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│                        apps/api                              │
│                    (Main API Service)                        │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  packages/db    │  │ packages/shared │  │ packages/config │
│  (Database)     │  │  (Utilities)    │  │ (Environment)   │
└────────┬────────┘  └────────┬────────┘  └─────────────────┘
         │                    │                   ▲
         └────────────────────┴───────────────────┘
                              │
                   uses packages/config
```

### Package Descriptions

| Package        | Purpose                                | Exports                             |
| -------------- | -------------------------------------- | ----------------------------------- |
| `@repo/api`    | HTTP API with OAuth authentication     | Entry point only                    |
| `@repo/db`     | Database schemas, services, connection | Schemas, services, types            |
| `@repo/shared` | Utilities, middleware, logging         | Logger, JWT, encryption, middleware |
| `@repo/config` | Environment validation, constants      | Env schemas, status codes           |

## Module Structure

Each feature in `apps/api/src/modules/` follows this pattern:

```
modules/
└── auth/                          # Feature module
    ├── auth.routes.ts             # Route registration
    ├── auth.metrics.ts            # Prometheus metrics
    ├── handlers/                  # Request handlers
    │   ├── get-oauth.handler.ts
    │   ├── get-oauth-callback.handler.ts
    │   └── post-refresh-token.handler.ts
    ├── providers/                 # External integrations
    │   ├── base.provider.ts       # Interface
    │   ├── google.provider.ts     # Implementation
    │   └── index.ts               # Factory
    └── services/                  # Business logic
        ├── oauth.service.ts
        └── token.service.ts
```

## Design Patterns

### 1. RouteHandler Pattern

Routes and handlers are colocated with OpenAPI schemas:

```typescript
// apps/api/src/modules/auth/handlers/get-oauth.handler.ts
import { createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import { StatusCodes, errorResponseSchemas } from "@repo/config";

// Define route with full OpenAPI schema
export const getOAuthRoute = createRoute({
  method: "get",
  path: "/oauth/:provider",
  tags: ["Auth"],
  summary: "Initiate OAuth flow",
  request: {
    params: z.object({
      provider: z.enum(["google"]),
    }),
  },
  responses: {
    [StatusCodes.HTTP_302_FOUND]: {
      description: "Redirect to OAuth provider",
    },
    ...errorResponseSchemas,
  },
});

// Handler with type safety from route definition
export const getOAuthHandler: RouteHandler<typeof getOAuthRoute> = async (c) => {
  const { provider } = c.req.valid("params");
  // ... implementation
};
```

### 2. Service Namespace Pattern

Database services use namespaces with optional logger:

```typescript
// packages/db/src/services/users.service.ts
export namespace UsersService {
  export async function create(
    payload: NewUser,
    logger?: LoggerInterface,
    options?: { tx?: DBTransaction },
  ) {
    const queryClient = options?.tx || db;
    const [user] = await queryClient.insert(usersTable).values(payload).returning();

    logger?.audit("User created", {
      module: "db",
      action: "service:create",
      userId: user.id,
    });

    return user;
  }

  export async function findByEmail(email: string) {
    return db.query.usersTable.findFirst({
      where: eq(usersTable.email, email),
    });
  }
}
```

### 3. Provider Factory Pattern

External integrations use a factory with a common interface:

```typescript
// Base interface
interface OAuthProvider {
  getAuthorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<TokenResponse>;
  getUserInfo(accessToken: string): Promise<UserInfo>;
}

// Factory
const oauthProviderFactory = {
  google: new GoogleProvider(),
  // github: new GitHubProvider(),
};

// Usage
const provider = oauthProviderFactory[providerName];
const url = provider.getAuthorizationUrl(state);
```

### 4. App Factory Pattern

Centralized app creation with consistent configuration:

```typescript
// packages/shared/src/create-app.ts
export function createApp() {
  const app = new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) {
        // Consistent validation error handling
        return c.json({ errors: result.error.issues }, StatusCodes.HTTP_400_BAD_REQUEST);
      }
    },
  });

  // Global middleware
  app.use("*", requestLoggerMiddleware());
  app.use("*", metricsMiddleware);
  app.use("*", globalRateLimiter);

  return app;
}

export function createRouter() {
  return new OpenAPIHono();
}
```

## Request Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                          HTTP Request                                │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Global Middleware (in order)                      │
│  1. Request Logger → 2. Metrics → 3. Rate Limiter → 4. CORS        │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Route Matching                               │
│                  Hono matches path to handler                        │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Route-Level Middleware                          │
│           (e.g., authRateLimiter, authentication)                    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Zod Validation                                 │
│            Validates params, query, body, headers                    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Handler                                     │
│        Business logic, calls services, returns response              │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Response Sent                                  │
│              Metrics recorded, logs written                          │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Architecture

### Schema Organization

```
packages/db/src/schema/
├── index.ts                    # Re-exports all schemas
└── users/
    ├── index.ts               # Domain exports
    ├── users.db.ts            # Users table
    └── sessions.db.ts         # Sessions table
```

### Table Conventions

```typescript
// Soft deletes with deletedAt
export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
```

### Transaction Support

```typescript
import { db, type DBTransaction } from "@repo/db";

async function createUserWithSession(payload: NewUser) {
  return db.transaction(async (tx) => {
    const user = await UsersService.create(payload, { tx });
    const session = await SessionService.create({ userId: user.id, provider: "google" }, { tx });
    return { user, session };
  });
}
```

## Security Architecture

### Authentication Flow

```
┌────────┐     ┌─────────┐     ┌──────────────┐     ┌────────────┐
│ Client │────▶│   API   │────▶│ OAuth Provider│────▶│  Database  │
└────────┘     └─────────┘     └──────────────┘     └────────────┘
    │               │                  │                    │
    │  1. GET /oauth/google            │                    │
    │◀──────────────│                  │                    │
    │  2. Redirect to Google           │                    │
    │─────────────────────────────────▶│                    │
    │  3. User authenticates           │                    │
    │◀─────────────────────────────────│                    │
    │  4. Redirect with code           │                    │
    │──────────────▶│                  │                    │
    │               │  5. Exchange code │                    │
    │               │─────────────────▶│                    │
    │               │  6. Tokens        │                    │
    │               │◀─────────────────│                    │
    │               │  7. Create/update user & session      │
    │               │─────────────────────────────────────▶│
    │  8. JWT tokens                   │                    │
    │◀──────────────│                  │                    │
```

### Token Strategy

| Token         | Storage              | Lifetime | Purpose              |
| ------------- | -------------------- | -------- | -------------------- |
| Access Token  | Client (memory)      | 15 min   | API authorization    |
| Refresh Token | HttpOnly cookie      | 7 days   | Get new access token |
| OAuth Tokens  | Database (encrypted) | Varies   | Provider API calls   |

### Encryption

- **Refresh tokens in DB**: AES-256-GCM encryption
- **State tokens**: Signed JWTs with 10-minute expiry
- **Passwords**: Never stored (OAuth only)

## Error Handling

### Global Error Handler

```typescript
// packages/shared/src/error-handler.ts
export function errorHandler(err: Error, c: Context) {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  logger.error("Unhandled error", {
    module: "system",
    action: "error:unhandled",
    error: err,
  });

  return c.json({ message: "Internal server error" }, StatusCodes.HTTP_500_INTERNAL_SERVER_ERROR);
}
```

### Error Response Schema

All routes include standardized error responses:

```typescript
import { errorResponseSchemas } from "@repo/config";

export const myRoute = createRoute({
  // ... route config
  responses: {
    [StatusCodes.HTTP_200_OK]: {
      /* success */
    },
    ...errorResponseSchemas, // 400, 401, 403, 404, 429, 500
  },
});
```

## Rate Limiting

Three tiers available:

```typescript
import { globalRateLimiter, authRateLimiter, strictRateLimiter } from "@repo/shared";

// Global: 100 requests / 15 minutes (applied to all routes)
app.use("*", globalRateLimiter);

// Auth: 20 requests / 15 minutes (for auth endpoints)
authRouter.use(authRateLimiter);

// Strict: 10 requests / 15 minutes (for sensitive operations)
sensitiveRouter.use(strictRateLimiter);
```

## Configuration Management

### Environment Variables

Validated at startup with Zod:

```typescript
// packages/config/src/env.ts
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  // ... other vars
});

// Fails fast if invalid
export const baseEnv = baseEnvSchema.parse(process.env);
```

### Status Codes

Always use the enum:

```typescript
import { StatusCodes } from "@repo/config";

// ✅ Good
return c.json(data, StatusCodes.HTTP_200_OK);

// ❌ Bad
return c.json(data, 200);
```

## Adding New Features

### 1. Create Module Structure

```bash
mkdir -p apps/api/src/modules/myfeature/{handlers,services}
```

### 2. Define Routes and Handlers

```typescript
// apps/api/src/modules/myfeature/handlers/get-resource.handler.ts
export const getResourceRoute = createRoute({
  /* ... */
});
export const getResourceHandler: RouteHandler<typeof getResourceRoute> = async (c) => {
  /* ... */
};
```

### 3. Create Route File

```typescript
// apps/api/src/modules/myfeature/myfeature.routes.ts
import { createRouter } from "@repo/shared";
import { getResourceRoute, getResourceHandler } from "./handlers/get-resource.handler";

export const myFeatureRouter = createRouter().openapi(getResourceRoute, getResourceHandler);
```

### 4. Register in Main App

```typescript
// apps/api/src/index.ts
import { myFeatureRouter } from "./modules/myfeature/myfeature.routes";

app.route("/v1/myfeature", myFeatureRouter);
```

## Development Commands

```bash
# Run all apps in development
bun run dev

# Run specific app
bun run dev --filter=@repo/api

# Generate database migrations
bun run db:generate

# Apply migrations
bun run db:migrate

# Type checking
bun run typecheck

# Linting
bun run lint
```

## Related Documentation

- [AUTHENTICATION.md](./AUTHENTICATION.md) - OAuth flow details
- [DATABASE.md](./DATABASE.md) - Schema and service patterns
- [MONITORING.md](./MONITORING.md) - Metrics and logging
- [LOGGING.md](./LOGGING.md) - Structured logging guide
