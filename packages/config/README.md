# @repo/config

Shared configuration package for the monorepo. Contains:

- **Base Environment Schema**: Common environment variables for all apps
- **HTTP Status Codes**: Centralized status code constants

## Base Environment Variables

The base environment schema contains variables that shared packages need:

```typescript
import { baseEnv, baseEnvSchema } from "@repo/config";

// Use in shared packages
console.log(baseEnv.NODE_ENV); // "development" | "staging" | "production"
console.log(baseEnv.LOG_LEVEL); // "info" | "debug" | etc.
```

### Available Base Variables

- `NODE_ENV`: Environment mode (development/staging/production)
- `LOG_LEVEL`: Logging level (fatal/error/warn/info/debug/trace)

## Extending for Apps

Apps should extend the base schema with their specific variables:

```typescript
import { z } from "zod";
import { baseEnvSchema } from "@repo/config";

// Extend base schema in your app
const appEnvSchema = baseEnvSchema.extend({
  PORT: z.string().optional().default("3000"),
  DATABASE_URL: z.string(),
  API_KEY: z.string(),
});

export const env = appEnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  LOG_LEVEL: process.env.LOG_LEVEL,
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  API_KEY: process.env.API_KEY,
});
```

## Status Codes

```typescript
import { StatusCodes } from "@repo/config";

// Use in responses
return c.json({ error }, StatusCodes.HTTP_400_BAD_REQUEST);
```
