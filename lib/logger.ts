/**
 * @fileoverview Minimal structured logger with service context.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface ServiceLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

function log(
  level: LogLevel,
  service: string,
  message: string,
  context?: Record<string, unknown>
): void {
  const parts = [
    `[${new Date().toISOString()}]`,
    `[${level.toUpperCase()}]`,
    `[${service}]`,
    message,
  ];
  if (context && Object.keys(context).length > 0) {
    parts.push(JSON.stringify(context));
  }
  const line = parts.join(" ");
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function createServiceLogger(service: string): ServiceLogger {
  return {
    debug: (message, context) => log("debug", service, message, context),
    info: (message, context) => log("info", service, message, context),
    warn: (message, context) => log("warn", service, message, context),
    error: (message, context) => log("error", service, message, context),
  };
}
