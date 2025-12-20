# API Service

The main API service with OAuth authentication and PostgreSQL database.

## Development

```bash
# From repository root
turbo dev --filter=@repo/api

# Or from this directory
bun run dev
```

## Database

```bash
# Start local PostgreSQL
docker compose -f docker-compose.dev.yml up -d

# Generate migration
bun run db:generate

# Run migration
bun run db:migrate
```

## Environment Variables

Copy `.env.example` from the root to `.env` and configure:

- `DATABASE_URL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `ENCRYPTION_KEY` (64-char hex string for AES-256)
- `JWT_SECRET` (min 32 chars)
