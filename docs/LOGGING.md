# Logging Guide

Structured logging with **Pino** and log aggregation via **Loki**.

## Overview

The logging system provides:

- **Structured JSON logs** with consistent metadata
- **Multiple transports**: Console (pretty) + Loki (aggregation)
- **Log levels**: trace, debug, info, warn, error, fatal, audit
- **Module tagging** for easy filtering
- **Error serialization** with stack traces
- **Request tracking** with child loggers

## Quick Start

```typescript
import { logger } from "@repo/shared";

// Basic logging
logger.info("User created", {
  module: "users",
  action: "service:create",
  userId: "123",
});

// Error logging (with stack trace)
logger.error("Failed to process request", {
  module: "auth",
  action: "oauth:callback",
  error: err,
});

// Security audit logging
logger.audit("Sensitive operation performed", {
  module: "security",
  action: "token:decrypt",
  userId: "123",
});
```

## Logger API

### Log Methods

```typescript
// Standard levels
logger.trace(message, meta); // Verbose debugging
logger.debug(message, meta); // Development debugging
logger.info(message, meta); // Normal operations
logger.warn(message, meta); // Potential issues
logger.error(message, meta); // Errors (serializes error objects)
logger.fatal(message, meta); // Critical failures

// Special methods
logger.audit(message, meta); // Security-sensitive actions
logger.child(bindings); // Create child logger with bound context
```

### Required Metadata

Every log call should include:

```typescript
interface LoggerMeta {
  module: "db" | "auth" | "users" | "system" | "session" | "security" | "http";
  action: string; // Format: "context:operation"
  [key: string]: any; // Additional context
}
```

### Module Types

| Module     | Description                   |
| ---------- | ----------------------------- |
| `db`       | Database operations           |
| `auth`     | Authentication flows          |
| `users`    | User management               |
| `system`   | System-level operations       |
| `session`  | Session management            |
| `security` | Security-sensitive operations |
| `http`     | HTTP request/response logging |

### Action Naming Convention

Format: `context:operation`

```typescript
// Examples
"service:create"; // UserService.create()
"oauth:callback"; // OAuth callback handler
"query:select"; // Database SELECT
"token:sign"; // JWT signing
"middleware:validate"; // Middleware validation
```

## Log Levels

### Configuration

Set via environment variable:

```bash
LOG_LEVEL=debug  # trace | debug | info | warn | error | fatal
```

### Level Hierarchy

```
trace (10) → debug (20) → info (30) → warn (40) → error (50) → fatal (60)
```

Setting `LOG_LEVEL=info` will show info, warn, error, and fatal logs.

### When to Use Each Level

| Level   | Use Case                                       | Example                              |
| ------- | ---------------------------------------------- | ------------------------------------ |
| `trace` | Extremely detailed debugging                   | Function entry/exit, variable dumps  |
| `debug` | Development debugging                          | Request payloads, intermediate state |
| `info`  | Normal operations worth noting                 | User created, OAuth completed        |
| `warn`  | Recoverable issues, degraded state             | Retry attempt, fallback used         |
| `error` | Failures requiring attention                   | Database error, API failure          |
| `fatal` | Critical failures, app shutdown                | Cannot connect to DB, config error   |
| `audit` | Security-sensitive actions (uses `info` level) | Token access, data decryption        |

## Child Loggers

Create child loggers with bound context for request tracking:

```typescript
import { logger } from "@repo/shared";

// In middleware - bind request context
const requestLogger = logger.child({
  requestId: crypto.randomUUID(),
  userId: user?.id,
  path: req.path,
});

// All subsequent logs include this context
requestLogger.info("Processing request", {
  module: "http",
  action: "request:start",
});

// Pass to handlers/services
await handler(c, requestLogger);
```

## Error Handling

### Logging Errors

The logger automatically serializes Error objects:

```typescript
try {
  await riskyOperation();
} catch (err) {
  logger.error("Operation failed", {
    module: "system",
    action: "operation:execute",
    error: err, // Serialized with name, message, stack
    context: { operationId: "123" },
  });
}
```

### Error Output Format

```json
{
  "level": "error",
  "time": "2024-01-15T10:30:00.000Z",
  "module": "db",
  "action": "query:select",
  "msg": "Database query failed",
  "err": {
    "type": "Error",
    "message": "Connection refused",
    "stack": "Error: Connection refused\n    at ..."
  }
}
```

## Integration with Services

### Database Services

```typescript
// packages/db/src/services/users.service.ts
export namespace UsersService {
  export async function create(
    payload: NewUser,
    logger?: {
      audit: (msg: string, meta: any) => void;
      error: (msg: string, meta: any) => void;
    },
  ) {
    try {
      const [user] = await db.insert(usersTable).values(payload).returning();

      logger?.audit("User created", {
        module: "db",
        action: "service:create",
        userId: user.id,
        email: user.email,
      });

      return user;
    } catch (err) {
      logger?.error("Failed to create user", {
        module: "db",
        action: "service:create",
        error: err,
        email: payload.email,
      });
      throw err;
    }
  }
}
```

### Handlers

```typescript
// apps/api/src/modules/auth/handlers/get-oauth.handler.ts
export const getOAuthHandler: RouteHandler<typeof getOAuthRoute> = async (c) => {
  const { provider } = c.req.valid("query");

  logger.info("OAuth flow initiated", {
    module: "auth",
    action: "oauth:start",
    provider,
  });

  // ... handler logic
};
```

## Loki Integration

### How It Works

Logs are shipped to Loki via `pino-loki` transport:

```
API (Pino) → pino-loki → HTTP POST → Loki → Grafana
```

### Configuration

```bash
# Enable Loki shipping (set in .env)
LOKI_HOST=http://localhost:3100
```

### Labels

These fields are extracted as Loki labels for indexing:

| Label         | Source            |
| ------------- | ----------------- |
| `application` | "api" (hardcoded) |
| `environment` | NODE_ENV          |
| `level`       | Log level         |
| `module`      | From log metadata |

### Querying in Grafana

```logql
# All API logs
{application="api"}

# Error logs only
{application="api", level="error"}

# Auth module logs
{application="api", module="auth"}

# Search for user ID
{application="api"} | json | userId="123"
```

## Console Output

### Development (pino-pretty)

```
[10:30:00 UTC] INFO: OAuth flow initiated
    module: "auth"
    action: "oauth:start"
    provider: "google"
```

### Production (JSON)

```json
{
  "level": "info",
  "time": "2024-01-15T10:30:00.000Z",
  "module": "auth",
  "action": "oauth:start",
  "provider": "google",
  "msg": "OAuth flow initiated",
  "env": "production"
}
```

## Best Practices

### 1. Always Include Module and Action

```typescript
// ✅ Good
logger.info("User logged in", {
  module: "auth",
  action: "login:success",
  userId: user.id,
});

// ❌ Bad - missing context
logger.info("User logged in");
```

### 2. Use Appropriate Log Levels

```typescript
// ✅ Good - info for normal operations
logger.info("Email sent", { module: "system", action: "email:send" });

// ❌ Bad - don't use debug for important events
logger.debug("Email sent", { module: "system", action: "email:send" });
```

### 3. Log at Boundaries

Log at entry/exit points of important operations:

```typescript
async function processPayment(orderId: string) {
  logger.info("Payment processing started", {
    module: "system",
    action: "payment:start",
    orderId,
  });

  try {
    const result = await chargeCard();

    logger.info("Payment completed", {
      module: "system",
      action: "payment:complete",
      orderId,
      transactionId: result.id,
    });

    return result;
  } catch (err) {
    logger.error("Payment failed", {
      module: "system",
      action: "payment:fail",
      orderId,
      error: err,
    });
    throw err;
  }
}
```

### 4. Avoid Sensitive Data

```typescript
// ✅ Good - log IDs, not sensitive data
logger.info("Token refreshed", {
  module: "auth",
  action: "token:refresh",
  userId: user.id,
});

// ❌ Bad - never log tokens, passwords, etc.
logger.info("Token refreshed", {
  module: "auth",
  action: "token:refresh",
  accessToken: token, // NEVER DO THIS
});
```

### 5. Use Audit for Security Events

```typescript
// Always audit security-sensitive operations
logger.audit("Refresh token decrypted", {
  module: "security",
  action: "token:decrypt",
  userId: user.id,
  sessionId: session.id,
});
```

### 6. Keep Messages Concise

```typescript
// ✅ Good - concise message, details in metadata
logger.info("User created", {
  module: "users",
  action: "service:create",
  userId: "123",
  email: "user@example.com",
});

// ❌ Bad - verbose message
logger.info("A new user with email user@example.com was successfully created in the database", {
  module: "users",
  action: "service:create",
});
```

## Troubleshooting

### Logs Not Appearing in Loki

1. Check `LOKI_HOST` is set correctly
2. Verify Loki is running: `curl http://localhost:3100/ready`
3. Check for pino-loki errors in console
4. Ensure Docker network allows communication

### Missing Stack Traces

Use the `error` key for Error objects:

```typescript
// ✅ Correct
logger.error("Failed", { module: "db", action: "query", error: err });

// ❌ Wrong - stack trace lost
logger.error("Failed: " + err.message, { module: "db", action: "query" });
```

### Log Level Not Working

1. Check `LOG_LEVEL` environment variable
2. Restart the application after changing
3. Verify in code: `console.log(baseEnv.LOG_LEVEL)`

## Related Documentation

- [MONITORING.md](./MONITORING.md) - Full observability stack guide
- [Pino Documentation](https://getpino.io/)
- [Loki Documentation](https://grafana.com/docs/loki/)
