import { TIMEOUTS } from '@/shared/constants';

export interface WaitOptions {
  timeoutMs: number;
  /** Polling interval for MutationObserver-triggered re-checks. */
  pollMs?: number;
}

/**
 * Resolves with the first non-null result of `probe`. Uses MutationObserver
 * to react to DOM changes (React-rendered pages) and a coarse interval as a
 * safety net for changes that don't bubble up to a parent (e.g. attribute
 * mutations on detached nodes).
 */
export function waitFor<T>(
  probe: () => T | null,
  options: WaitOptions,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const immediate = probe();
    if (immediate !== null) {
      resolve(immediate);
      return;
    }

    let settled = false;
    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearInterval(poll);
      clearTimeout(deadline);
      fn();
    };

    const check = (): void => {
      try {
        const result = probe();
        if (result !== null) settle(() => resolve(result));
      } catch (err) {
        settle(() => reject(err));
      }
    };

    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: false,
    });

    const poll = setInterval(check, options.pollMs ?? TIMEOUTS.domPollMs);

    const deadline = setTimeout(() => {
      settle(() =>
        reject(
          Object.assign(new Error('Timed out waiting for element.'), {
            code: 'WAIT_TIMEOUT',
          }),
        ),
      );
    }, options.timeoutMs);
  });
}
