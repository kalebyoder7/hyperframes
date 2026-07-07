import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export interface LoggerOptions {
  module: string;
  minLevel?: LogLevel;
  logFilePath?: string;
}

export class Logger {
  private readonly module: string;
  private readonly minLevel: LogLevel;
  private readonly logFilePath?: string;

  constructor(options: LoggerOptions) {
    this.module = options.module;
    this.minLevel =
      options.minLevel ?? (process.env["LOG_LEVEL"] as LogLevel | undefined) ?? "info";
    this.logFilePath = options.logFilePath;
    if (this.logFilePath) {
      const dir = dirname(this.logFilePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    }
  }

  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      module: this.module,
      message,
      ...(meta ? { meta } : {}),
    });
    const consoleFn =
      level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    consoleFn(line);
    if (this.logFilePath) {
      appendFileSync(this.logFilePath, line + "\n");
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write("debug", message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write("error", message, meta);
  }
}

export function createLogger(module: string, logFilePath?: string): Logger {
  return new Logger({ module, logFilePath });
}
