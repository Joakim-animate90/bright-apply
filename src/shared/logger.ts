import { MAX_LOG_ENTRIES } from './constants';
import type { LogEntry, LogLevel } from './types';

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  entries(): readonly LogEntry[];
  clear(): void;
}

export function createLogger(scope: LogEntry['scope']): Logger {
  const buffer: LogEntry[] = [];

  const write = (
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
  ): void => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      scope,
      message,
      ...(context ? { context } : {}),
    };
    buffer.push(entry);
    if (buffer.length > MAX_LOG_ENTRIES) {
      buffer.splice(0, buffer.length - MAX_LOG_ENTRIES);
    }
    const tag = `[BrightApply/${scope}]`;
    switch (level) {
      case 'debug':
        // eslint-disable-next-line no-console
        console.debug(tag, message, context ?? '');
        break;
      case 'info':
        console.info(tag, message, context ?? '');
        break;
      case 'warn':
        console.warn(tag, message, context ?? '');
        break;
      case 'error':
        console.error(tag, message, context ?? '');
        break;
    }
  };

  return {
    debug: (m, c) => write('debug', m, c),
    info: (m, c) => write('info', m, c),
    warn: (m, c) => write('warn', m, c),
    error: (m, c) => write('error', m, c),
    entries: () => buffer.slice(),
    clear: () => {
      buffer.length = 0;
    },
  };
}

export function formatLogEntry(entry: LogEntry): string {
  const ctx = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
  return `${entry.timestamp} [${entry.level.toUpperCase()}] (${entry.scope}) ${entry.message}${ctx}`;
}
