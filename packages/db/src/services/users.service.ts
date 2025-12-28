import { type NewUser, type UpdateUser, usersTable } from "../schema";
import { eq } from "drizzle-orm";
import { type DBTransaction, db } from "../connection";
import { withMetrics } from "../utils/metrics-wrapper";
import { logger } from "@repo/shared";

export namespace UsersService {
  /**
   * Creates a new user in the database
   * @param payload - The new user's data
   * @param options - extra options for a query
   */
  export async function create(
    payload: NewUser,
    options?: {
      /**
       * database transaction object
       */
      tx?: DBTransaction;
    },
  ) {
    const queryClient = options?.tx || db;

    try {
      const result = await withMetrics("insert", "users", async () =>
        queryClient.insert(usersTable).values(payload).returning(),
      );
      const [createdUser] = result;

      logger.audit("new user created", {
        module: "users",
        action: "service:create",
      });

      return createdUser;
    } catch (err) {
      logger.error("error creating user", {
        module: "users",
        action: "service:create",
        error: err,
      });

      throw err;
    }
  }

  /**
   * Find a user by id
   * @param id id of the user
   * @param options extra options for the query
   */
  export async function findById(
    id: string,
    options?: {
      /**
       * database transaction object
       */
      tx?: DBTransaction;
    },
  ) {
    try {
      const queryClient = options?.tx || db;

      return await withMetrics("select", "users", async () =>
        queryClient.query.usersTable.findFirst({
          where: eq(usersTable.id, id),
        }),
      );
    } catch (err) {
      logger.error("Error finding user by id", {
        module: "users",
        action: "service:findById",
        error: err,
      });
      throw err;
    }
  }

  /**
   * Find a user by email (excluding soft-deleted users)
   * @param email - The user's email
   * @param options extra options for a query
   */
  export async function findByEmail(
    email: string,
    options?: {
      /**
       * database transaction object
       */
      tx?: DBTransaction;
      /**
       * Include soft-deleted users in the search
       */
      includeDeleted?: boolean;
    },
  ) {
    const queryClient = options?.tx || db;
    try {
      return await withMetrics("select", "users", async () =>
        queryClient.query.usersTable.findFirst({
          where: (table, { eq, and, isNull }) =>
            options?.includeDeleted
              ? eq(table.email, email)
              : and(eq(table.email, email), isNull(table.deletedAt)),
        }),
      );
    } catch (err) {
      logger.error("error finding user by email", {
        module: "users",
        action: "service:findByEmail",
        error: err,
      });
      throw err;
    }
  }

  /**
   * Find a user by provider account ID (excluding soft-deleted users)
   * @param providerAccountId - The provider account ID
   * @param options extra options for a query
   */
  export async function findByProviderAccountId(
    providerAccountId: string,
    options?: {
      /**
       * database transaction object
       */
      tx?: DBTransaction;
      /**
       * Include soft-deleted users in the search
       */
      includeDeleted?: boolean;
    },
  ) {
    const queryClient = options?.tx || db;
    try {
      return await withMetrics("select", "users", async () =>
        queryClient.query.usersTable.findFirst({
          where: (table, { eq, and, isNull }) =>
            options?.includeDeleted
              ? eq(table.providerAccountId, providerAccountId)
              : and(eq(table.providerAccountId, providerAccountId), isNull(table.deletedAt)),
        }),
      );
    } catch (err) {
      logger.error("error finding user by provider account id", {
        module: "users",
        action: "service:findByProviderAccountId",
        error: err,
      });
      throw err;
    }
  }

  /**
   * Creates or updates a user (upsert pattern to prevent race conditions)
   * @param payload - The user's data
   * @param options extra options for a query
   */
  export async function upsertByProviderAccountId(
    payload: NewUser,
    options?: {
      /**
       * database transaction object
       */
      tx?: DBTransaction;
    },
  ) {
    if (!options?.tx) {
      throw new Error(
        "Transaction is required for upsertByProviderAccountId to prevent race conditions",
      );
    }
    const queryClient = options.tx;
    try {
      // Try to find existing user by provider account ID first
      let user = await findByProviderAccountId(payload.providerAccountId, {
        tx: queryClient,
        includeDeleted: false,
      });

      if (user) {
        // Update existing user
        user = await updateById(
          user.id,
          {
            email: payload.email,
            firstName: payload.firstName,
            lastName: payload.lastName,
            avatar: payload.avatar,
            providerAccountId: payload.providerAccountId,
          },
          { tx: queryClient },
        );
      } else {
        // Try to find by email to handle provider account ID changes
        const userByEmail = await findByEmail(payload.email, {
          tx: queryClient,
          includeDeleted: false,
        });

        if (userByEmail) {
          // Update existing user with new provider account ID
          user = await updateById(
            userByEmail.id,
            {
              email: payload.email,
              firstName: payload.firstName,
              lastName: payload.lastName,
              avatar: payload.avatar,
              providerAccountId: payload.providerAccountId,
            },
            { tx: queryClient },
          );
        } else {
          // Create new user
          user = await create(payload, { tx: queryClient });
        }
      }

      return user;
    } catch (err) {
      logger.error("error upserting user by provider account id", {
        module: "users",
        action: "service:upsertByProviderAccountId",
        error: err,
      });
      throw err;
    }
  }

  /**
   * Update a user by id
   * @param id id of the user to update
   * @param payload new details to update
   * @param options extra options for a query
   */
  export async function updateById(
    id: string,
    payload: UpdateUser,
    options?: {
      /**
       * database transaction object
       */
      tx?: DBTransaction;
    },
  ) {
    const queryClient = options?.tx || db;
    try {
      const result = await withMetrics("update", "users", async () =>
        queryClient
          .update(usersTable)
          .set({
            ...payload,
            updatedAt: new Date(),
          })
          .where(eq(usersTable.id, id))
          .returning(),
      );
      const [updatedUser] = result;

      logger.audit("user updated by id", {
        module: "users",
        action: "service:updateById",
      });

      return updatedUser;
    } catch (err) {
      logger.error("error updating user by id", {
        module: "users",
        action: "service:updateById",
        error: err,
      });

      throw err;
    }
  }
}
