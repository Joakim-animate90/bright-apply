import { TIMEOUTS } from '@/shared/constants';
import { BrightApplyError } from '@/shared/errors';
import type { Logger } from '@/shared/logger';

export async function openHiddenTab(
  url: string,
  logger: Logger,
): Promise<chrome.tabs.Tab> {
  const tab = await chrome.tabs.create({ url, active: false }).catch((err) => {
    throw new BrightApplyError('TAB_OPEN_FAILED', 'Could not open background tab.', {
      cause: err instanceof Error ? err.message : String(err),
    });
  });
  logger.info('Opened background tab', { tabId: tab.id, url });
  return tab;
}

export async function closeTabSafely(
  tabId: number | undefined,
  logger: Logger,
): Promise<void> {
  if (typeof tabId !== 'number') return;
  try {
    await chrome.tabs.remove(tabId);
    logger.info('Closed background tab', { tabId });
  } catch (err) {
    logger.warn('Failed to close background tab (already gone?)', {
      tabId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Resolves when the given tab reaches status === 'complete'. Rejects with a
 * BrightApplyError if `signal` aborts or the load times out.
 */
export function waitForTabComplete(
  tabId: number,
  signal: AbortSignal,
  logger: Logger,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      signal.removeEventListener('abort', onAbort);
      clearTimeout(timer);
      fn();
    };

    const onUpdated = (
      updatedTabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
    ): void => {
      if (updatedTabId !== tabId) return;
      if (changeInfo.status === 'complete') {
        logger.info('Tab finished loading', { tabId });
        settle(resolve);
      }
    };

    const onRemoved = (removedTabId: number): void => {
      if (removedTabId !== tabId) return;
      settle(() =>
        reject(
          new BrightApplyError(
            'TAB_LOAD_TIMEOUT',
            'Background tab was closed before it finished loading.',
          ),
        ),
      );
    };

    const onAbort = (): void => {
      settle(() =>
        reject(new BrightApplyError('ABORTED', 'Tab load aborted by caller.')),
      );
    };

    const timer = setTimeout(() => {
      settle(() =>
        reject(
          new BrightApplyError(
            'TAB_LOAD_TIMEOUT',
            `Background tab failed to load within ${TIMEOUTS.tabLoadMs}ms.`,
            { tabId, timeoutMs: TIMEOUTS.tabLoadMs },
          ),
        ),
      );
    }, TIMEOUTS.tabLoadMs);

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    signal.addEventListener('abort', onAbort, { once: true });

    chrome.tabs.get(tabId, (tab) => {
      const err = chrome.runtime.lastError;
      if (err) {
        settle(() =>
          reject(
            new BrightApplyError(
              'TAB_OPEN_FAILED',
              err.message ?? 'Could not query tab status.',
            ),
          ),
        );
        return;
      }
      if (tab.status === 'complete') {
        logger.info('Tab already complete', { tabId });
        settle(resolve);
      }
    });
  });
}
