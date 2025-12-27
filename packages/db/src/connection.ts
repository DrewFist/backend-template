import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import { logger, dbConnectionsGauge } from "@repo/shared";

export interface DBConfig {
  connectionString: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
}

let pool: Pool;
let dbInstance: ReturnType<typeof drizzle>;

/**
 * Initialize database connection with config
 */
export function initializeDB(config: DBConfig) {
  pool = new Pool({
    connectionString: config.connectionString,
    ssl: config.ssl !== undefined ? config.ssl : { rejectUnauthorized: false },
  });

  // Track active connections with metrics
  pool.on("connect", () => {
    dbConnectionsGauge.inc();
  });

  pool.on("remove", () => {
    dbConnectionsGauge.dec();
  });

  pool.on("error", (err) => {
    logger.error("Database pool error", {
      module: "db",
      action: "pool:error",
      error: err,
    });
  });

  dbInstance = drizzle(pool, { schema, casing: "snake_case" });
}

export function getDB() {
  if (!dbInstance) {
    throw new Error("Database not initialized. Call initializeDB first.");
  }
  return dbInstance;
}

// Type for the Drizzle instance with our schema
type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

// Legacy export for backward compatibility with proper typing
export const db = new Proxy({} as DrizzleDB, {
  get(target, prop) {
    return getDB()[prop as keyof DrizzleDB];
  },
});

export async function connectDB() {
  if (!pool) {
    throw new Error("Database not initialized. Call initializeDB first.");
  }

  try {
    const client = await pool.connect();
    client.release();

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
    } catch (error: any) {
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
