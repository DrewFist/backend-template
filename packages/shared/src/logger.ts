import pino from "pino";
import type { TransportTargetOptions } from "pino";
import { baseEnv } from "@repo/config";

type LoggerModules = "db" | "auth" | "users" | "system" | "session" | "security" | "http";

interface LoggerMeta {
  module: LoggerModules;
  action: string;
  [key: string]: any;
}

const isDevelopment = baseEnv.NODE_ENV === "development";

// Build transport targets
function buildTransports(): TransportTargetOptions[] {
  const targets: TransportTargetOptions[] = [];

  // Pretty print in development
  if (isDevelopment) {
    targets.push({
      target: "pino-pretty",
      level: baseEnv.LOG_LEVEL,
      options: {
        colorize: true,
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
        singleLine: false,
        errorLikeObjectKeys: ["err", "error"],
      },
    });
  } else {
    // JSON output to stdout in production
    targets.push({
      target: "pino/file",
      level: baseEnv.LOG_LEVEL,
      options: { destination: 1 }, // stdout
    });
  }

  // Always ship to Loki if host is configured
  if (baseEnv.LOKI_HOST) {
    targets.push({
      target: "pino-loki",
      level: baseEnv.LOG_LEVEL,
      options: {
        batching: true,
        interval: 5, // Send logs every 5 seconds
        host: baseEnv.LOKI_HOST,
        // Extract these fields as Loki labels for filtering
        labels: {
          application: "api",
          environment: baseEnv.NODE_ENV,
        },
        // Convert pino level number to string label
        propsToLabels: ["level", "module"],
        // Replace pino timestamp with Loki timestamp
        replaceTimestamp: true,
      },
    });
  }

  return targets;
}

// Create base pino instance with proper error serialization
const pinoInstance = pino({
  level: baseEnv.LOG_LEVEL,
  transport: {
    targets: buildTransports(),
  },
  // Note: Cannot use formatters.level with transport.targets - pino restriction
  serializers: {
    // Properly serialize errors with stack traces
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  base: {
    env: baseEnv.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export namespace logger {
  /**
   * Creates a child logger with bound context (useful for request tracking)
   */
  export function child(bindings: Record<string, any>) {
    return pinoInstance.child(bindings);
  }

  export function info(message: string, meta: LoggerMeta) {
    pinoInstance.info(meta, message);
  }

  export function error(message: string, meta: LoggerMeta & { error?: Error | string }) {
    // Extract error object if present for proper serialization
    const { error: err, ...restMeta } = meta;
    if (err) {
      // Handle both Error objects and strings
      const errorObj = err instanceof Error ? err : new Error(String(err));
      pinoInstance.error({ ...restMeta, err: errorObj }, message);
    } else {
      pinoInstance.error(restMeta, message);
    }
  }

  export function warn(message: string, meta: LoggerMeta) {
    pinoInstance.warn(meta, message);
  }

  export function debug(message: string, meta: LoggerMeta) {
    pinoInstance.debug(meta, message);
  }

  export function audit(message: string, meta: LoggerMeta) {
    pinoInstance.info({ ...meta, audit: true }, `[AUDIT] ${message}`);
  }

  /**
   * Logs security-related events (failed auth, suspicious activity, etc.)
   */
  export function security(message: string, meta: LoggerMeta) {
    pinoInstance.error(
      {
        ...meta,
        module: "security",
        security: true,
      },
      `[SECURITY] ${message}`,
    );
  }

  /**
   * Get the raw pino instance for advanced usage (e.g., pino-http)
   */
  export function getInstance() {
    return pinoInstance;
  }
}
