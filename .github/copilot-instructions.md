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

**Always use the factory pattern** from `@/lib/factory` for handlers:

```typescript
import { factory } from "@/lib/factory";

export const myHandler = factory.createHandlers(
  customZValidator("param", schema), // validation middleware
  (c) => {
    // handler logic
    return c.json({ data });
  },
);
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
       logger?: { audit: (msg: string, meta: any) => void; error: (msg: string, meta: any) => void },
       options?: { tx?: DBTransaction }
     ) {
       const queryClient = options?.tx || db;
       return queryClient.insert(usersTable).values(payload).returning();
     }
   }
   ```

5. **Transaction support**: Services accept optional `tx` parameter for transaction support

### Validation & Error Handling

- **Use `customZValidator`** (not raw zValidator) - it formats errors consistently:
  ```typescript
  customZValidator("param", z.object({ provider: z.nativeEnum(SessionProvider) }));
  ```
- Throws `HTTPException` with custom responses:
  ```typescript
  throw new HTTPException(StatusCodes.HTTP_400_BAD_REQUEST, {
    res: c.json({ message: "Error message" }),
  });
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

## Environment & Configuration

- **Env validation**: All env vars in `apps/api/src/config/env.ts` with Zod schemas and validation
- **Path aliases**: Use `@/*` for `src/*` (configured in `apps/api/tsconfig.json`)
- **Status codes**: Import from `@/config/status-codes` instead of hardcoding
- **Shared packages**: Import from `@repo/shared` for cross-service types and utils
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

- [apps/api/src/modules/auth/auth.routes.ts](apps/api/src/modules/auth/auth.routes.ts) - Generic OAuth routing pattern
- [apps/api/src/modules/auth/providers/base.provider.ts](apps/api/src/modules/auth/providers/base.provider.ts) - Provider interface
- [packages/db/src/connection.ts](packages/db/src/connection.ts) - DB setup with transaction types
- [packages/db/src/services/users.service.ts](packages/db/src/services/users.service.ts) - Example service pattern
- [apps/api/src/middlewares/custom-z-validator.ts](apps/api/src/middlewares/custom-z-validator.ts) - Validation wrapper
- [apps/api/src/lib/factory.ts](apps/api/src/lib/factory.ts) - Handler factory pattern

## Project-Specific Conventions

1. **No default exports for routes** - use named exports, import with `default` keyword
2. **Soft deletes**: Tables use `deletedAt` timestamp pattern
3. **All timestamps** use `{ withTimezone: true }`
4. **Service errors**: Always pass logger to db services and log with module/action metadata before throwing
5. **Route versioning**: All routes under `/v1/` prefix via `apps/api/src/api/v1/index.ts`
6. **Database initialization**: Always call `initializeDB()` before `connectDB()` in app startup
