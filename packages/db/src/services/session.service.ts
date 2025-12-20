import { sessionsTable, type NewSession } from "../schema";
import { db, type DBTransaction } from "../connection";
import { eq } from "drizzle-orm";

export namespace SessionService {
  /**
   * Creates a new session in the database
   * @param payload new session
   * @param logger - Optional logger instance for logging
   * @param options extra options for query
   * @returns the created session
   */
  export async function create(
    payload: NewSession,
    logger?: { audit: (msg: string, meta: any) => void; error: (msg: string, meta: any) => void },
    options?: {
      /**
       * Transaction to use for the query
       */
      tx?: DBTransaction;
    },
  ) {
    const queryClient = options?.tx ?? db;
    try {
      const [session] = await queryClient.insert(sessionsTable).values(payload).returning();

      logger?.audit("Created new session", {
        module: "session",
        action: "service:create",
        session: session,
      });

      return session;
    } catch (err) {
      logger?.error("Error creating session", {
        module: "session",
        action: "service:create",
        error: err,
      });

      throw err;
    }
  }

  /**
   * Finds a session by id
   * @param id session id to find by
   * @param logger - Optional logger instance for logging
   * @param options extra options for query
   * @returns the found session
   */
  export async function findById(
    id: string,
    logger?: { error: (msg: string, meta: any) => void },
    options?: {
      /**
       * Transaction to use for the query
       */
      tx?: DBTransaction;
    },
  ) {
    const queryClient = options?.tx ?? db;
    try {
      return await queryClient.query.sessionsTable.findFirst({
        where: eq(sessionsTable.id, id),
      });
    } catch (err) {
      logger?.error("Error finding session by id", {
        module: "session",
        action: "service:findById",
        error: err,
      });

      throw err;
    }
  }
}
