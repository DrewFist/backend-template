import { dbQueryDuration, dbErrorCounter } from "@repo/shared";

/**
 * Wraps a database operation with metrics tracking
 * @param operation - The type of operation (select, insert, update, delete, transaction)
 * @param table - The table being queried
 * @param fn - The database operation function
 */
export async function withMetrics<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>,
): Promise<T> {
  const timer = dbQueryDuration.startTimer({ operation, table });

  try {
    const result = await fn();
    timer();
    return result;
  } catch (error) {
    timer();
    dbErrorCounter.inc({
      operation,
      error_type: error instanceof Error ? error.name : "Unknown",
    });
    throw error;
  }
}
