/**
 * Structured Logger — JSON logs for production observability.
 *
 * Usage:
 *   log.info('expense_logged', { userId, vendor, amount, latencyMs });
 *   log.warn('gemini_slow', { userId, latencyMs: 5000 });
 *   log.error('classification_failed', { userId, error: err.message });
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  data?: Record<string, any>;
}

function emit(level: LogLevel, event: string, data?: Record<string, any>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    data,
  };

  const json = JSON.stringify(entry);

  switch (level) {
    case 'error':
      console.error(json);
      break;
    case 'warn':
      console.warn(json);
      break;
    default:
      console.log(json);
  }
}

export const log = {
  info: (event: string, data?: Record<string, any>) => emit('info', event, data),
  warn: (event: string, data?: Record<string, any>) => emit('warn', event, data),
  error: (event: string, data?: Record<string, any>) => emit('error', event, data),

  /** Measure and log execution time */
  async measure<T>(event: string, data: Record<string, any>, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      emit('info', event, { ...data, latencyMs: Date.now() - start });
      return result;
    } catch (err: any) {
      emit('error', `${event}_failed`, { ...data, latencyMs: Date.now() - start, error: err.message });
      throw err;
    }
  },
};
