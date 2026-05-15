import { createLogger } from '@/shared/logger';
import type {
  AnyRequest,
  PingContentResponse,
  ScrapeApplyFormResponse,
} from '@/shared/messages';
import { isAllowedHost } from '@/shared/url';
import { tryScrapeApplyForm } from './scraper';
import { waitFor } from './waiter';

const logger = createLogger('content');
logger.info('Content script attached', { href: window.location.href });

if (!isAllowedHost(window.location.hostname)) {
  logger.warn('Refusing to operate on non-allowed host', {
    hostname: window.location.hostname,
  });
}

chrome.runtime.onMessage.addListener((message: AnyRequest, _sender, sendResponse) => {
  handle(message)
    .then(sendResponse)
    .catch((err: unknown) => {
      logger.error('Content message handler failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      sendResponse({
        ok: false,
        code: 'UNEXPECTED',
        message: err instanceof Error ? err.message : String(err),
      } satisfies ScrapeApplyFormResponse);
    });
  return true;
});

async function handle(message: AnyRequest): Promise<unknown> {
  if (!isAllowedHost(window.location.hostname)) {
    throw new Error('Content script invoked on a non-allowed host.');
  }

  switch (message.type) {
    case 'PING_CONTENT': {
      const response: PingContentResponse = {
        pong: true,
        href: window.location.href,
      };
      return response;
    }
    case 'SCRAPE_APPLY_FORM': {
      return scrape(message.jobUrl, message.timeoutMs);
    }
    default:
      throw new Error(`Content script received unsupported message: ${message.type}`);
  }
}

async function scrape(
  jobUrl: string,
  timeoutMs: number,
): Promise<ScrapeApplyFormResponse> {
  try {
    const form = await waitFor(() => tryScrapeApplyForm(jobUrl), { timeoutMs });
    logger.info('Apply form located', {
      endpoint: form.endpoint,
      fieldCount: form.fields.length,
    });
    return { ok: true, form };
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err && err.code === 'WAIT_TIMEOUT'
        ? 'FORM_SCRAPE_TIMEOUT'
        : 'FORM_NOT_FOUND';
    const message =
      code === 'FORM_SCRAPE_TIMEOUT'
        ? `No apply form appeared within ${timeoutMs}ms.`
        : err instanceof Error
          ? err.message
          : 'Could not locate apply form.';
    logger.warn('Form scrape failed', { code, message });
    return { ok: false, code, message };
  }
}
