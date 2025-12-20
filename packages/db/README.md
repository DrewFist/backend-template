# @repo/db

Shared database package for the monorepo. Contains:

- Database connection setup
- Drizzle ORM schemas
- Database services (CRUD operations)

## Usage

```typescript
import { db, connectDB, UsersService, SessionsService } from "@repo/db";

// In your app startup
await connectDB();

// Use services
const user = await UsersService.findByEmail("user@example.com");
```

## Structure

- `src/connection.ts` - Database connection and transaction types
- `src/schema/` - Drizzle ORM table schemas
- `src/services/` - Database CRUD operations organized by domain
