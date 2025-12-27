# Server Template - Turborepo Monorepo

A production-ready **Bun + Hono + TypeScript + PostgreSQL + Drizzle ORM** monorepo template built with Turborepo. This template provides a solid foundation for building scalable backend services with OAuth authentication, real-time features, and shared packages.

## 🚀 Features

- **Monorepo Architecture**: Turborepo with Bun workspaces for managing multiple services
- **Modern Stack**: Bun runtime, Hono web framework, TypeScript, PostgreSQL, Drizzle ORM
- **Metrics & Monitoring**: Prometheus + Grafana with pre-configured dashboards
- **OpenAPI Integration**: Type-safe API definitions with @hono/zod-openapi and Scalar documentation
- **OAuth Authentication**: Extensible OAuth provider factory pattern (Google included)
- **Rate Limiting**: Built-in rate limiting with hono-rate-limiter (global + route-specific)
- **Global Error Handling**: Centralized error handling with standardized response schemas
- **CORS Configuration**: Environment-specific CORS with credentials support
- **Shared Packages**: Centralized configuration, database layer, and utilities
- **Type-Safe**: Full TypeScript with strict mode and Zod validation
- **Structured Logging**: Winston logger with audit trails
- **Security**: JWT tokens, AES-256-GCM encryption, CSRF protection
- **Developer Experience**: Hot reload, path aliases, colocated route definitions

## 📁 Project Structure

```
├── apps/
│   ├── api/                    # Main API service
│   │   ├── src/
│   │   │   ├── modules/       # Feature modules (auth, etc.)
│   │   │   └── index.ts       # App entry point
│   │   └── drizzle.config.ts  # Drizzle ORM configuration
│   │
│   └── metrics/                # Metrics monitoring service
│       ├── src/               # Metrics server (optional)
│       ├── prometheus.yml     # Prometheus configuration
│       └── grafana/           # Grafana dashboards & provisioning
│
├── packages/
│   ├── config/                # Environment variables & constants
│   │   ├── env.ts            # Zod-validated environment config
│   │   └── status-codes.ts   # HTTP status code constants
│   │
│   ├── db/                    # Shared database package
│   │   ├── connection.ts     # Database connection & types
│   │   ├── schema/           # Drizzle ORM schemas
│   │   └── services/         # Database CRUD operations
│   │
│   └── shared/                # Shared utilities
│       ├── create-app.ts     # OpenAPI app factory with error handling
│       ├── configure-openapi.ts  # Scalar documentation setup
│       ├── logger.ts         # Winston logger
│       ├── jwt.ts            # JWT utilities
│       ├── encryption.ts     # AES encryption
│       ├── error-handler.ts  # Global error handling
│       ├── error-schemas.ts  # OpenAPI error response schemas
│       ├── rate-limiter.ts   # Rate limiting configurations
│       ├── helpers.ts        # Common helpers
│       ├── metrics/          # Prometheus metrics
│       │   ├── registry.ts   # Central metrics registry
│       │   ├── http.metrics.ts    # HTTP/API metrics
│       │   └── db.metrics.ts      # Database metrics
│       └── middleware/
│           ├── custom-z-validator.ts  # Zod validation wrapper
│           ├── metrics.middleware.ts  # Metrics collection
│           └── request-logger.middleware.ts  # Request logging
│
├── docs/
│   └── MONITORING.md          # Complete monitoring guide
├── docker-compose.dev.yml     # PostgreSQL + Prometheus + Grafana
├── turbo.json                 # Turborepo configuration
└── package.json               # Workspace root
```

## 🛠️ Quick Start

### Prerequisites

- [Bun](https://bun.sh/) v1.3.1 or higher
- [Docker](https://www.docker.com/) (for local PostgreSQL)
- PostgreSQL (or use Docker Compose)

### 1. Clone the Template

```bash
# Clone or copy this template to your project directory
cp -r server-template your-project-name
cd your-project-name

# Remove git history and start fresh
rm -rf .git
git init
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Set Up Environment Variables

Create a `.env` file in `apps/api/`:

```bash
cd apps/api
cp .env.example .env  # If you have an example file, or create manually
```

Required environment variables:

````env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/your-db-name

# Server
PORT=3000
NODE_ENV=development

# OAuth - Google (add your credentials)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/v1/auth/oauth/google/callback

# Security
JWT_SECRET=your-jwtServices (Database + Monitoring)

```bash
# From project root
docker compose -f docker-compose.dev.yml up -d
````

This starts:

- **PostgreSQL** on `localhost:5432` with database `backend-template`
- **Prometheus** on `localhost:9090` for metrics collection
- **Grafana** on `localhost:3001` for metrics visualization (admin/admin)

### 4. Start Local Database

```bash
cd apps/api
docker compose -f docker-compose.dev.yml up -d
```

This starts PostgreSQL on `localhost:5432` with database `backend-template`.

### 5. Run Database Migrations

```bash
# From project root
bun run db:generate  # Generate migrations from schema
bun run db:migrate   # Apply migrations to database
```

### 6. Start Development

```bash
# Start all services (Docker + API + Metrics)
bun run dev

# Or start services individually:
bun run dev:services  # Start Docker services only
bun run dev:api       # Start API server only
bun run dev:metrics   # Start metrics server only
```

The API will be available at `http://localhost:3000`

## 📖 Usage Guide

### Adding a New Service

To add a new service to the monorepo:

1. **Create the service directory**:

   ```bash
   mkdir -p apps/your-service/src
   cd apps/your-service
   ```

2. **Create `package.json`**:

   ```json
   {
     "name": "@repo/your-service",
     "version": "1.0.0",
     "private": true,
     "scripts": {
       "dev": "bun --watch src/index.ts",
       "build": "bun build src/index.ts --outdir dist"
     },
     "dependencies": {
       "@repo/config": "workspace:*",
       "@repo/db": "workspace:*",
       "@repo/shared": "workspace:*",
       "hono": "^4.10.3"
     },
     "devDependencies": {
       "typescript": "^5.7.3"
     }
   }
   ```

3. **Install dependencies**:

   ```bash
   bun install
   ```

4. **Create your service code** in `src/index.ts` and start building!

### Adding a New Module

Modules live in `apps/api/src/modules/{feature}/`. Example structure:

```
modules/
└── your-feature/
    ├── feature.routes.ts       # Hono router
    ├── handlers/              # Request handlers
    │   └── get-items.handler.ts
    └── services/              # Business logic
        └── items.service.ts
```

**Example handler** (`handlers/get-items.handler.ts`):

```typescript
import { createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import { StatusCodes, errorResponseSchemas } from "@repo/config";

// Route definition
export const getItemsRoute = createRoute({
  method: "get",
  path: "/items",
  tags: ["Items"],
  summary: "Get items",
  request: {
    query: z.object({
      limit: z.string().optional().default("10"),
    }),
  },
  responses: {
    [StatusCodes.HTTP_200_OK]: {
      content: {
        "application/json": {
          schema: z.object({
            items: z.array(z.any()),
          }),
        },
      },
      description: "Items retrieved successfully",
    },
    ...errorResponseSchemas,
  },
});

// Handler implementation
export const getItemsHandler: RouteHandler<typeof getItemsRoute> = async (c) => {
  const { limit } = c.req.valid("query");
  // Your logic here
  return c.json({ items: [] }, StatusCodes.HTTP_200_OK);
};
```

**Register routes** (`feature.routes.ts`):

```typescript
import { createRouter } from "@repo/shared";
import { getItemsRoute, getItemsHandler } from "./handlers/get-items.handler";

const yourFeatureRoutes = createRouter().openapi(getItemsRoute, getItemsHandler);

export default yourFeatureRoutes;
```

**Add to API** (`apps/api/src/index.ts`):

```typescript
import yourFeatureRoutes from "@/modules/your-feature/feature.routes";

app.route("/v1/your-feature", yourFeatureRoutes);
```

**View API Documentation**: Visit `http://localhost:3000/docs` to see your routes in Scalar UI

### Adding Database Tables

1. **Create schema** in `packages/db/src/schema/your-domain/`:

```typescript
// packages/db/src/schema/items/items.db.ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const itemsTable = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type Item = typeof itemsTable.$inferSelect;
export type NewItem = typeof itemsTable.$inferInsert;
```

2. **Export from index** (`packages/db/src/schema/index.ts`):

```typescript
export * from "./items/items.db";
```

3. **Create service** (`packages/db/src/services/items.service.ts`):

```typescript
import { db } from "../connection";
import { itemsTable, type NewItem } from "../schema";
import type { Logger } from "@repo/shared";

export namespace ItemsService {
  export async function create(payload: NewItem, logger?: Logger) {
    try {
      const [item] = await db.insert(itemsTable).values(payload).returning();
      logger?.audit?.("Item created", { module: "db", action: "items:create" });
      return item;
    } catch (error) {
      logger?.error?.("Failed to create item", { module: "db", action: "items:create", error });
      throw error;
    }
  }
}
```

4. **Export from services** (`packages/db/src/services/index.ts`):

```typescript
export * from "./items.service";
```

5. **Generate and run migration**:

```bash
bun run db:generate
bun run db:migrate
```

### Adding OAuth Providers

The template uses a provider factory pattern. To add a new OAuth provider:

1. **Create provider** (`apps/api/src/modules/auth/providers/github.provider.ts`):

```typescript
import type { OAuthProvider, OAuthUserProfile } from "./base.provider";

export const githubProvider: OAuthProvider = {
  name: "github",

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: env.GITHUB_REDIRECT_URI,
      state,
      scope: "user:email",
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  },

  async exchangeCodeForTokens(code: string) {
    // Implementation for token exchange
  },

  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    // Implementation for fetching user profile
  },

  async refreshAccessToken(refreshToken: string) {
    // Implementation for token refresh
  },
};
```

2. **Register in factory** (`apps/api/src/modules/auth/providers/index.ts`):

```typescript
import { githubProvider } from "./github.provider";

export const oauthProviderFactory = {
  google: googleProvider,
  github: githubProvider,
};
```

3. **Add env variables** to `packages/config/src/env.ts`:

```typescript
GITHUB_CLIENT_ID: z.string(),
GITHUB_CLIENT_SECRET: z.string(),
GITHUB_REDIRECT_URI: z.string().url(),
```

The routes automatically work with any registered provider!

## 🗄️ Database Commands

```bash
# Generate migration from schema changes
bun run db:generate

# Apply migrations to database
bun run db:migrate

# Drop database (warning: destructive!)
bun run db:drop
```

## 🏗️ Common Commands

```bash
# Development
bun run dev              # Start Docker services + all apps
bun run dev:services     # Start Docker services only (PostgreSQL + Prometheus + Grafana)
bun run dev:api          # Start API server only
bun run dev:metrics      # Start metrics server only

# Docker Services
bun run stop             # Stop all Docker services
bun run logs             # View Docker service logs

# Database
bun run db:generate      # Generate migrations from schema
bun run db:migrate       # Apply migrations to database

# Build & Quality
bun run build            # Build all apps and packages
bun run type-check       # Type check all packages
bun run lint             # Lint all packages
bun run clean            # Clean all build artifacts
```

## 🔐 Security Best Practices

1. **Never commit `.env` files** - Add to `.gitignore`
2. **Generate strong secrets**:

   ```bash
   # JWT Secret (32+ chars)
   openssl rand -base64 32

   # Encryption Key (64 hex chars)
   openssl rand -hex 32
   ```

3. **Use environment-specific configs** for development, staging, production
4. **Enable SSL** in production (set `NODE_ENV=production`)
5. **Rotate secrets** regularly

## 📝 Key Conventions

- **Import aliases**: Use `@repo/*` for workspace packages, `@/*` for local paths
- **Naming**: `kebab-case` for files, `PascalCase` for types, `camelCase` for functions
- **Exports**: Named exports preferred, routes exported as default
- **Database**: `snake_case` for columns (configured in drizzle.config.ts)
- **Soft deletes**: Use `deletedAt` timestamp pattern
- **Logging**: Always pass logger to services with module/action metadata
- **Route Definitions**: Colocate with handlers using `createRoute()` + `RouteHandler<typeof route>`
- **Status Codes**: Always use `StatusCodes` enum from `@repo/config`
- **Error Responses**: Always include `...errorResponseSchemas` in route responses
- **Handlers**: Use `RouteHandler<typeof route>` pattern for type safety
- **OpenAPI**: All routes use OpenAPI schemas for automatic documentation

## 🧪 Common Patterns

### Error Handling

```typescript
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "@repo/config";

// Throw errors with consistent format
throw new HTTPException(StatusCodes.HTTP_400_BAD_REQUEST, {
  res: c.json({ message: "Error message", errors: {} }),
});

// Use error response schemas in route definitions
import { errorResponseSchemas } from "@repo/config";

export const myRoute = createRoute({
  // ...
  responses: {
    [StatusCodes.HTTP_200_OK]: {
      /* success response */
    },
    ...errorResponseSchemas, // Adds 400, 401, 403, 404, 429, 500
  },
});
```

### Rate Limiting

```typescript
import { authRateLimiter, strictRateLimiter } from "@repo/shared";

// Apply to specific routes
const router = createRouter()
  .use(authRateLimiter) // 20 requests per 15 min
  .openapi(route, handler);

// Or use strict limiting
const strictRouter = createRouter()
  .use(strictRateLimiter) // 10 requests per 15 min
  .openapi(route, handler);
```

### Transaction Support

```typescript
import { db } from "@repo/db";

await db.transaction(async (tx) => {
  await UsersService.create(userData, logger, { tx });
  await SessionService.create(sessionData, logger, { tx });
});
```

### Structured Logging

```typescript
import { logger } from "@repo/shared";

logger.info("User logged in", {
  module: "auth",
  action: "oauth:callback",
  userId: user.id,
});

logger.error("Database error", {
  module: "db",
  action: "users:create",
  error: err.message,
});

logger.audit("Sensitive action", {
  module: "users",
  action: "service:delete",
  userId: user.id,
});
```

## 📊 Monitoring & Metrics

The template includes a complete monitoring stack with Prometheus and Grafana.

### Quick Start

```bash
# Start everything (Docker services + API + Metrics)
bun run dev

# Or start services separately:
bun run dev:services  # Docker only
bun run dev:api       # API only
bun run dev:metrics   # Metrics server only
```

### Access Dashboards

- **API Server**: http://localhost:3000
- **API Metrics**: http://localhost:3000/metrics (Prometheus format)
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)
- **Metrics Server**: http://localhost:3002 (optional)

### Available Metrics

- **HTTP Metrics**: Request rate, latency, error rate by route/method/status
- **Database Metrics**: Query performance, connection pool usage
- **OAuth Metrics**: OAuth requests/success/failures by provider

### Pre-configured Dashboards

The template includes a Grafana dashboard with 11 panels:

- Total Requests, Error Rate, P95 Response Time
- Request Rate by Method & Status Code
- Response Time Percentiles (P50/P95/P99)
- Database Query Performance
- OAuth Analytics

### Adding Custom Metrics

```typescript
import { Counter } from "prom-client";
import { metricsRegistry } from "@repo/shared/metrics";

export const myCounter = new Counter({
  name: "my_operations_total",
  help: "Total operations",
  labelNames: ["type", "status"],
  registers: [metricsRegistry],
});

// In your code
myCounter.inc({ type: "batch", status: "success" });
```

📖 **Full Documentation**: See [docs/MONITORING.md](docs/MONITORING.md) for detailed setup, PromQL queries, troubleshooting, and best practices.

## 🤝 Contributing

This is a template - customize it for your needs! Common modifications:

- Add more OAuth providers
- Add email/password authentication
- Add rate limiting middleware
- Add API documentation (Swagger/OpenAPI)
- Add testing setup (Bun test)
- Add CI/CD pipelines
- Add monitoring and observability

## 📚 Tech Stack

- **Runtime**: [Bun](https://bun.sh/) v1.3.1+
- **Framework**: [Hono](https://hono.dev/) v4.10.3+
- **OpenAPI**: [@hono/zod-openapi](https://github.com/honojs/middleware) v0.18.4+
- **Documentation**: [Scalar](https://scalar.com/) v1.0.0+
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Drizzle](https://orm.drizzle.team/) v0.44.7+
- **Validation**: [Zod](https://zod.dev/) v4.1.12+
- **Logging**: [Winston](https://github.com/winstonjs/winston) v3.18.3+
- **Rate Limiting**: [hono-rate-limiter](https://github.com/rhinobase/hono-rate-limiter) v0.5.0+
- **Monorepo**: [Turborepo](https://turbo.build/) v2.7.0+

## 📄 License

This is a template - use it however you want! No attribution required.

## 🆘 Troubleshooting

### Port already in use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Database connection failed

```bash
# Check if PostgreSQL is running
docker ps

# Restart services
docker compose -f docker-compose.dev.yml restart
```

### Monitoring services not accessible

```bash
# Check all Docker services are running
docker compose -f docker-compose.dev.yml ps

# View logs
bun run logs

# Restart monitoring stack
docker compose -f docker-compose.dev.yml restart prometheus grafana
```

### Module not found errors

```bash
# Reinstall dependencies
rm -rf node_modules apps/*/node_modules packages/*/node_modules
bun install
```

### TypeScript errors

```bash
# Check all packages
bun run type-check
```

---

**Happy Building! 🚀**

For questions or issues with the template, feel free to open an issue or refer to the [Copilot Instructions](.github/copilot-instructions.md) for AI-assisted development guidance.
