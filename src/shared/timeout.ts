import { BrightApplyError } from './errors';
import type { BrightApplyErrorCode } from './errors';

export interface TimeoutOptions {
  ms: number;
  code: BrightApplyErrorCode;
  message: string;
  signal?: AbortSignal;
}

/**
 * Race `promise` against a timer. The timer's AbortController is exposed so
 * callers can wire it into fetches: `signal: combineSignals(external, timer.signal)`.
 */
export function withTimeout<T>(
  promise: (signal: AbortSignal) => Promise<T>,
  options: TimeoutOptions,
): Promise<T> {
  const controller = new AbortController();
  const externalAbort = (): void => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', externalAbort, { once: true });
    }
  }

  const timer = setTimeout(() => {
    controller.abort();
  }, options.ms);

  return promise(controller.signal)
    .catch((err) => {
      if (controller.signal.aborted && !options.signal?.aborted) {
        throw new BrightApplyError(options.code, options.message, {
          timeoutMs: options.ms,
        });
      }
      throw err;
    })
    .finally(() => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', externalAbort);
    });
}

export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
