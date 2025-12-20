# Server Template - Turborepo Monorepo

A production-ready **Bun + Hono + TypeScript + PostgreSQL + Drizzle ORM** monorepo template built with Turborepo. This template provides a solid foundation for building scalable backend services with OAuth authentication, real-time features, and shared packages.

## 🚀 Features

- **Monorepo Architecture**: Turborepo with Bun workspaces for managing multiple services
- **Modern Stack**: Bun runtime, Hono web framework, TypeScript, PostgreSQL, Drizzle ORM
- **OAuth Authentication**: Extensible OAuth provider factory pattern (Google included)
- **Shared Packages**: Centralized configuration, database layer, and utilities
- **Type-Safe**: Full TypeScript with strict mode and Zod validation
- **Structured Logging**: Winston logger with audit trails
- **Security**: JWT tokens, AES-256-GCM encryption, CSRF protection
- **Developer Experience**: Hot reload, path aliases, consistent error handling

## 📁 Project Structure

```
├── apps/
│   └── api/                    # Main API service
│       ├── src/
│       │   ├── api/v1/        # API route versioning
│       │   ├── modules/       # Feature modules (auth, chat, etc.)
│       │   └── index.ts       # App entry point
│       ├── drizzle/           # Database migrations
│       ├── drizzle.config.ts  # Drizzle ORM configuration
│       └── docker-compose.dev.yml  # Local PostgreSQL
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
│       ├── factory.ts        # Hono handler factory
│       ├── logger.ts         # Winston logger
│       ├── jwt.ts            # JWT utilities
│       ├── encryption.ts     # AES encryption
│       ├── helpers.ts        # Common helpers
│       └── middlewares/      # Shared middlewares
│
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

```env
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
JWT_SECRET=your-jwt-secret-min-32-chars
ENCRYPTION_KEY=your-64-char-hex-encryption-key  # Generate with: openssl rand -hex 32
```

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

### 6. Start Development Server

```bash
bun run dev
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
import { factory, customZValidator } from "@repo/shared";
import { z } from "zod";

export const getItemsHandler = factory.createHandlers(
  customZValidator(
    "query",
    z.object({
      limit: z.string().optional().default("10"),
    }),
  ),
  async (c) => {
    const { limit } = c.req.valid("query");
    // Your logic here
    return c.json({ items: [] });
  },
);
```

**Register routes** (`feature.routes.ts`):

```typescript
import { Hono } from "hono";
import { getItemsHandler } from "./handlers/get-items.handler";

const yourFeatureRoutes = new Hono();

yourFeatureRoutes.get("/items", ...getItemsHandler);

export default yourFeatureRoutes;
```

**Add to API** (`apps/api/src/api/v1/index.ts`):

```typescript
import yourFeatureRoutes from "@/modules/your-feature/feature.routes";

v1Routes.route("/your-feature", yourFeatureRoutes);
```

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

## 🏗️ Build Commands

```bash
# Build all apps and packages
bun run build

# Run development mode (all services)
bun run dev

# Run development mode (specific service)
bun run dev --filter=@repo/api

# Type check all packages
bun run type-check

# Clean all build artifacts
bun run clean
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
- **Exports**: Named exports preferred, no default exports for routes
- **Database**: `snake_case` for columns (configured in drizzle.config.ts)
- **Soft deletes**: Use `deletedAt` timestamp pattern
- **Logging**: Always pass logger to services with module/action metadata
- **Validation**: Use `customZValidator` (not raw zValidator)
- **Handlers**: Always use factory pattern from `@repo/shared`

## 🧪 Common Patterns

### Error Handling

```typescript
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "@repo/config";

throw new HTTPException(StatusCodes.HTTP_400_BAD_REQUEST, {
  res: c.json({ message: "Error message", errors: {} }),
});
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

- **Runtime**: [Bun](https://bun.sh/) v1.3.1
- **Framework**: [Hono](https://hono.dev/) v4.10.3
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Drizzle](https://orm.drizzle.team/) v0.44.7
- **Validation**: [Zod](https://zod.dev/) v4.1.12
- **Logging**: [Winston](https://github.com/winstonjs/winston) v3.18.3
- **Monorepo**: [Turborepo](https://turbo.build/) v2.7.0

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

# Restart database
cd apps/api
docker compose -f docker-compose.dev.yml restart
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
