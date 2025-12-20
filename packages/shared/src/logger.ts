import winston from "winston";

type LoggerModules = "db" | "auth" | "users" | "system" | "session" | "security";

interface LoggerMeta {
  module: LoggerModules;
  action: string;
  [key: string]: any;
}

const infoLogger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.errors({ stack: true }),
      ),
    }),
  ],
  level: "info",
});

const errorLogger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.errors({ stack: true }),
      ),
    }),
  ],
  level: "error",
});

const warningLogger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.errors({ stack: true }),
      ),
    }),
  ],
  level: "warn",
});

const auditLogger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.errors({ stack: true }),
      ),
    }),
  ],
  level: "info",
});

export namespace logger {
  export function info(message: string, meta: LoggerMeta) {
    infoLogger.info(message, {
      ...meta,
    });
  }

  export function error(message: string, meta: LoggerMeta) {
    errorLogger.error(message, {
      ...meta,
    });
  }

  export function warn(message: string, meta: LoggerMeta) {
    warningLogger.warn(message, {
      ...meta,
    });
  }

  export function audit(message: string, meta: LoggerMeta) {
    auditLogger.info(message, {
      ...meta,
    });
  }

  /**
   * Logs security-related events (failed auth, suspicious activity, etc.)
   * @param message - The security event message
   * @param meta - Additional metadata about the security event
   */
  export function security(message: string, meta: LoggerMeta) {
    errorLogger.error(`[SECURITY] ${message}`, {
      ...meta,
      module: "security",
    });
  }
}
