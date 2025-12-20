# @repo/config

Shared configuration package for the monorepo. Contains:

- Environment variable validation and types
- HTTP status codes constants
- Shared configuration values

## Usage

```typescript
import { env, StatusCodes } from "@repo/config";

// Use environment variables
console.log(env.DATABASE_URL);

// Use status codes
return c.json({ error }, StatusCodes.HTTP_400_BAD_REQUEST);
```
