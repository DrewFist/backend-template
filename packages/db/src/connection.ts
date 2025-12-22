import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@repo/config";
import * as schema from "./schema";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import { logger } from "@repo/shared";

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema, casing: "snake_case" });

export async function connectDB() {
  try {
    const client = await pool.connect();
    client.release();

    logger.info("Database connected", {
      module: "db",
      action: "connect",
    });

    return true;
  } catch (error) {
    throw error;
  }
}

export async function closeDB() {
  if (pool && !pool.ended) {
    try {
      await pool.end();
      logger.info("Database disconnected", {
        module: "db",
        action: "disconnect",
      });
    } catch (error) {
      logger.error("Failed to close database", {
        module: "db",
        action: "disconnect",
        error,
      });
    }
  }
}

export type DBTransaction = PgTransaction<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;
