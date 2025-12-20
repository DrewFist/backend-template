# Shared Package

Shared types, utilities, and constants that can be used across multiple services in the monorepo.

## Usage

In your app's `package.json`:

```json
{
  "dependencies": {
    "@repo/shared": "workspace:*"
  }
}
```

Then import in your code:

```typescript
import { BaseResponse, ErrorResponse } from "@repo/shared";
```
