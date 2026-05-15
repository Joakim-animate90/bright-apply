import { TIMEOUTS } from '@/shared/constants';
import { BrightApplyError, toBrightApplyError } from '@/shared/errors';
import { createLogger, type Logger } from '@/shared/logger';
import { sendToTab } from '@/shared/messages';
import { buildPayloadPreview, truncateBody } from '@/shared/redact';
import { withTimeout } from '@/shared/timeout';
import type {
  ApplyAttemptSummary,
  ApplyOutcome,
  LogEntry,
  ScrapedForm,
} from '@/shared/types';
import { parseJobUrl } from '@/shared/url';
import { checkSession } from './session';
import {
  closeTabSafely,
  openHiddenTab,
  waitForContentScript,
  waitForTabComplete,
} from './tabManager';

interface InFlight {
  controller: AbortController;
  tabId?: number;
}

const inFlight = new Map<string, InFlight>();

export function cancelApply(requestId: string): boolean {
  const entry = inFlight.get(requestId);
  if (!entry) return false;
  entry.controller.abort();
  return true;
}

export async function applyToJob(
  jobUrlRaw: string,
  requestId: string,
): Promise<ApplyOutcome> {
  const logger = createLogger('background');
  const startedAt = new Date();
  const controller = new AbortController();
  const entry: InFlight = { controller };
  inFlight.set(requestId, entry);

  let tabId: number | undefined;

  try {
    logger.info('Apply request received', { requestId, jobUrlRaw });
    const { url: parsed } = parseJobUrl(jobUrlRaw);
    const jobUrl = parsed.toString();

    const session = await checkSession(logger);
    if (session.status !== 'loggedIn') {
      throw new BrightApplyError(
        'NOT_LOGGED_IN',
        'No active BrighterMonday session detected. Please log in in your browser first.',
      );
    }

    const tab = await openHiddenTab(jobUrl, logger);
    tabId = tab.id;
    entry.tabId = tabId;
    if (typeof tabId !== 'number') {
      throw new BrightApplyError(
        'TAB_OPEN_FAILED',
        'Background tab was created without an id.',
      );
    }

    await waitForTabComplete(tabId, controller.signal, logger);
    await waitForContentScript(tabId, controller.signal, logger);

    const scrapeResponse = await sendToTab(tabId, {
      type: 'SCRAPE_APPLY_FORM',
      jobUrl,
      timeoutMs: TIMEOUTS.formScrapeMs,
    });

    if (!scrapeResponse.ok) {
      throw new BrightApplyError(
        normalizeScrapeError(scrapeResponse.code),
        scrapeResponse.message,
      );
    }

    const form = scrapeResponse.form;
    logger.info('Form scraped', {
      endpoint: form.endpoint,
      method: form.method,
      fieldCount: form.fields.length,
      jobId: form.jobId,
      hasCsrf: Boolean(form.csrfToken),
    });

    const summary = await submitApplication(form, jobUrl, controller.signal, logger);

    return {
      ok: true,
      summary: {
        ...summary,
        startedAt: startedAt.toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
      },
      logs: logger.entries() as LogEntry[],
    };
  } catch (rawError) {
    const error = toBrightApplyError(rawError);
    logger.error(error.message, { code: error.code, details: error.details });
    return {
      ok: false,
      failure: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
      logs: logger.entries() as LogEntry[],
    };
  } finally {
    await closeTabSafely(tabId, logger);
    inFlight.delete(requestId);
  }
}

async function submitApplication(
  form: ScrapedForm,
  jobUrl: string,
  signal: AbortSignal,
  logger: Logger,
): Promise<Omit<ApplyAttemptSummary, 'startedAt' | 'durationMs'>> {
  const finishedAt = new Date();
  const headers = new Headers({
    Accept: 'application/json, text/html, */*;q=0.8',
    'X-Requested-With': 'XMLHttpRequest',
    Origin: 'https://www.brightermonday.co.ke',
    Referer: jobUrl,
  });
  if (form.csrfToken) {
    headers.set('X-CSRF-TOKEN', form.csrfToken);
    headers.set('X-XSRF-TOKEN', form.csrfToken);
  }

  let body: BodyInit | undefined;
  if (form.method === 'POST') {
    if (form.enctype === 'multipart/form-data') {
      const fd = new FormData();
      for (const field of form.fields) {
        fd.append(field.name, field.value);
      }
      body = fd;
    } else {
      const params = new URLSearchParams();
      for (const field of form.fields) {
        params.append(field.name, field.value);
      }
      body = params.toString();
      headers.set('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
    }
  }

  logger.info('Submitting application', {
    endpoint: form.endpoint,
    method: form.method,
    enctype: form.enctype,
    hasBody: Boolean(body),
  });

  const response = await withTimeout(
    (timeoutSignal) =>
      fetch(form.endpoint, {
        method: form.method,
        credentials: 'include',
        headers,
        body: form.method === 'POST' ? body : undefined,
        signal: timeoutSignal,
        mode: 'cors',
        redirect: 'follow',
      }),
    {
      ms: TIMEOUTS.fetchMs,
      code: 'SUBMIT_TIMEOUT',
      message: `Apply submission exceeded ${TIMEOUTS.fetchMs}ms.`,
      signal,
    },
  ).catch((err) => {
    if (err instanceof BrightApplyError) throw err;
    throw new BrightApplyError(
      'SUBMIT_FAILED',
      err instanceof Error ? err.message : 'Apply submission failed.',
    );
  });

  const text = await response.text().catch(() => '');
  const success = response.ok && !looksLikeLoginRedirect(response, text);

  logger.info('Apply submission complete', {
    httpStatus: response.status,
    ok: response.ok,
    success,
    contentLength: text.length,
    finalUrl: response.url,
  });

  if (!success) {
    throw new BrightApplyError(
      'SUBMIT_REJECTED',
      `Apply endpoint rejected the submission (HTTP ${response.status}).`,
      {
        httpStatus: response.status,
        finalUrl: response.url,
        snippet: truncateBody(text, 300),
      },
    );
  }

  return {
    jobUrl,
    endpoint: form.endpoint,
    method: form.method,
    status: 'success',
    httpStatus: response.status,
    payloadPreview: buildPayloadPreview(form.fields),
    responseSnippet: truncateBody(text),
    finishedAt: finishedAt.toISOString(),
  };
}

function looksLikeLoginRedirect(response: Response, body: string): boolean {
  if (response.url.includes('/login') || response.url.includes('/sign-in')) {
    return true;
  }
  const lower = body.toLowerCase();
  if (lower.includes('please log in') || lower.includes('please sign in')) {
    return true;
  }
  return false;
}

function normalizeScrapeError(code: string): BrightApplyError['code'] {
  switch (code) {
    case 'FORM_NOT_FOUND':
      return 'FORM_NOT_FOUND';
    case 'FORM_SCRAPE_TIMEOUT':
      return 'FORM_SCRAPE_TIMEOUT';
    case 'ENDPOINT_NOT_FOUND':
      return 'ENDPOINT_NOT_FOUND';
    case 'CSRF_TOKEN_NOT_FOUND':
      return 'CSRF_TOKEN_NOT_FOUND';
    default:
      return 'UNEXPECTED';
  }
}
