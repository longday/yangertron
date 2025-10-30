import { inspect } from "node:util";

type LogLevel = "info" | "warn" | "error";

type LogWriter = (...args: unknown[]) => void;

type ConsoleMethod = (...data: unknown[]) => void;

const consoleByLevel: Record<LogLevel, ConsoleMethod> = {
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

interface PlainError {
  name: string;
  message: string;
  stack?: string;
  cause?: unknown;
}

const inspectOptions = Object.freeze({
  depth: 6,
  maxArrayLength: 200,
  breakLength: 160,
  compact: false,
});

function toPlainError(error: Error): PlainError {
  const plain: PlainError = {
    name: error.name,
    message: error.message,
  };

  if (error.stack) {
    plain.stack = error.stack;
  }

  if ("cause" in error) {
    plain.cause = (error as Error & { cause?: unknown }).cause;
  }

  return plain;
}

function normalizeArg(value: unknown): unknown {
  if (value instanceof Error) {
    return toPlainError(value);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "function") {
    return value.name ? `[Function ${value.name}]` : "[Function anonymous]";
  }

  if (typeof value === "symbol") {
    return value.toString();
  }

  if (typeof value === "object" && value !== null) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_error) {
      return inspect(value, inspectOptions);
    }
  }

  return value;
}

function write(level: LogLevel, args: unknown[]) {
  const target = consoleByLevel[level] ?? console.log;
  const normalizedArgs = args.map(normalizeArg);
  target(...normalizedArgs);
}

const createLogWriter = (level: LogLevel): LogWriter => {
  return (...args: unknown[]) => {
    write(level, args);
  };
};

export const log = Object.freeze({
  info: createLogWriter("info"),
  warn: createLogWriter("warn"),
  error: createLogWriter("error"),
}) satisfies Record<LogLevel, LogWriter>;

export type Logger = typeof log;
