import { sessionsTable, type NewSession, type UpdateSession } from "../schema";
import { db, type DBTransaction } from "../connection";
import { eq } from "drizzle-orm";
import { withMetrics } from "../utils/metrics-wrapper";
import { logger } from "@repo/shared";

export namespace SessionService {
  /**
   * Creates a new session in the database
   * @param payload new session
   * @param options extra options for query
   * @returns the created session
   */
  export async function create(
    payload: NewSession,
    options?: {
      /**
       * Transaction to use for the query
       */
      tx?: DBTransaction;
    },
  ) {
    const queryClient = options?.tx ?? db;
    try {
      const result = await withMetrics("insert", "sessions", async () =>
        queryClient.insert(sessionsTable).values(payload).returning(),
      );
      const [session] = result;

      logger.audit("Created new session", {
        module: "session",
        action: "service:create",
        session: session,
      });

      return session;
    } catch (err) {
      logger.error("Error creating session", {
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
   * @param options extra options for query
   * @returns the found session
   */
  export async function findById(
    id: string,
    options?: {
      /**
       * Transaction to use for the query
       */
      tx?: DBTransaction;
    },
  ) {
    const queryClient = options?.tx ?? db;
    try {
      return await withMetrics("select", "sessions", async () =>
        queryClient.query.sessionsTable.findFirst({
          where: eq(sessionsTable.id, id),
        }),
      );
    } catch (err) {
      logger.error("Error finding session by id", {
        module: "session",
        action: "service:findById",
        error: err,
      });

      throw err;
    }
  }

  /**
   * Update a session by id
   * @param id session id to update
   * @param payload new details to update
   * @param options extra options for query
   * @returns the updated session
   */
  export async function updateById(
    id: string,
    payload: UpdateSession,
    options?: {
      /**
       * Transaction to use for the query
       */
      tx?: DBTransaction;
    },
  ) {
    const queryClient = options?.tx ?? db;
    try {
      const result = await withMetrics("update", "sessions", async () =>
        queryClient
          .update(sessionsTable)
          .set({
            ...payload,
            updatedAt: new Date(),
          })
          .where(eq(sessionsTable.id, id))
          .returning(),
      );
      const [updatedSession] = result;

      logger.audit("Updated session by id", {
        module: "session",
        action: "service:updateById",
        sessionId: id,
      });

      return updatedSession;
    } catch (err) {
      logger.error("Error updating session by id", {
        module: "session",
        action: "service:updateById",
        error: err,
      });

      throw err;
    }
  }
}
