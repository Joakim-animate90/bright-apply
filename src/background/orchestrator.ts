import {
  COVER_LETTER_FIELD_HINTS,
  DEFAULT_COVER_LETTER,
  RESUME_FIELD_HINTS,
  TIMEOUTS,
} from '@/shared/constants';
import { BrightApplyError, toBrightApplyError } from '@/shared/errors';
import { resumeAttachmentToBlob } from '@/shared/fileEncoding';
import { createLogger, type Logger } from '@/shared/logger';
import { buildPayloadPreview, truncateBody } from '@/shared/redact';
import { withTimeout } from '@/shared/timeout';
import type {
  ApplyAttemptSummary,
  ApplyOutcome,
  LogEntry,
  ResumeAttachment,
  ScrapedField,
  ScrapedFileField,
  ScrapedForm,
} from '@/shared/types';
import { parseJobUrl } from '@/shared/url';
import {
  inPageScrapeApplyForm,
  type InPagePlainForm,
  type InPageScrapeResult,
} from './inPageScraper';
import { checkSession } from './session';
import { closeTabSafely, openHiddenTab, waitForTabComplete } from './tabManager';

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
  resume?: ResumeAttachment,
  coverLetter?: string,
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

    const scrapeOutcome = await runScraperInTab(tabId, jobUrl, controller.signal, logger);
    if (!scrapeOutcome.ok) {
      throw new BrightApplyError(
        scrapeOutcome.code === 'FORM_SCRAPE_TIMEOUT'
          ? 'FORM_SCRAPE_TIMEOUT'
          : 'FORM_NOT_FOUND',
        scrapeOutcome.message,
        { href: scrapeOutcome.href },
      );
    }

    const form: ScrapedForm = scrapeOutcome.form;
    logger.info('Form scraped', {
      endpoint: form.endpoint,
      method: form.method,
      fieldCount: form.fields.length,
      fileFieldCount: form.fileFields.length,
      jobId: form.jobId,
      hasCsrf: Boolean(form.csrfToken),
      href: scrapeOutcome.href,
    });

    if (form.fileFields.some((f) => f.required) && !resume) {
      throw new BrightApplyError(
        'SUBMIT_REJECTED',
        'This job requires a resume upload. Attach one in the popup and try again.',
        { requiredFileFields: form.fileFields.filter((f) => f.required).map((f) => f.name) },
      );
    }

    const coverLetterText =
      typeof coverLetter === 'string' && coverLetter.trim().length > 0
        ? coverLetter
        : DEFAULT_COVER_LETTER;
    const coverLetterFieldName = pickCoverLetterFieldName(form.fields);
    const textareaNames = form.fields
      .filter((f) => f.type === 'textarea')
      .map((f) => f.name);
    if (coverLetterFieldName) {
      form.fields = form.fields.map((f) =>
        f.name === coverLetterFieldName ? { ...f, value: coverLetterText } : f,
      );
      logger.info('Cover letter applied', {
        field: coverLetterFieldName,
        charCount: coverLetterText.length,
        usedDefault: coverLetterText === DEFAULT_COVER_LETTER,
        textareasInForm: textareaNames,
      });
    } else {
      logger.warn('No cover-letter field detected — appending description fallback', {
        textareasInForm: textareaNames,
        allFieldNames: form.fields.map((f) => f.name),
      });
      form.fields = [
        ...form.fields,
        {
          name: 'description',
          value: coverLetterText,
          type: 'textarea',
          required: false,
        },
      ];
    }

    const summary = await submitApplication(
      form,
      jobUrl,
      resume,
      controller.signal,
      logger,
    );

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
  resume: ResumeAttachment | undefined,
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

  // If we have a resume but the form has no file fields, fall back to common
  // BrighterMonday-style names so the upload still has somewhere to land.
  const resumeTargetField =
    resume && form.fileFields.length > 0
      ? pickResumeFieldName(form.fileFields)
      : resume
        ? 'resume'
        : null;

  // A resume implies multipart, regardless of what the form's enctype said.
  const effectiveEnctype: ScrapedForm['enctype'] =
    resume ? 'multipart/form-data' : form.enctype;

  let body: BodyInit | undefined;
  if (form.method === 'POST') {
    if (effectiveEnctype === 'multipart/form-data') {
      const fd = new FormData();
      for (const field of form.fields) {
        fd.append(field.name, field.value);
      }
      if (resume && resumeTargetField) {
        const blob = resumeAttachmentToBlob(resume);
        fd.append(resumeTargetField, blob, resume.fileName);
        logger.info('Attached resume to FormData', {
          field: resumeTargetField,
          fileName: resume.fileName,
          mimeType: resume.mimeType,
          byteLength: resume.byteLength,
        });
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
    enctype: effectiveEnctype,
    hasBody: Boolean(body),
    hasResume: Boolean(resume),
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

  const payloadPreview = buildPayloadPreview(form.fields);
  if (resume && resumeTargetField) {
    payloadPreview[resumeTargetField] =
      `<file: ${resume.fileName} (${resume.mimeType}, ${resume.byteLength} bytes)>`;
  }

  return {
    jobUrl,
    endpoint: form.endpoint,
    method: form.method,
    status: 'success',
    httpStatus: response.status,
    payloadPreview,
    responseSnippet: truncateBody(text),
    finishedAt: finishedAt.toISOString(),
  };
}

function pickResumeFieldName(fileFields: readonly ScrapedFileField[]): string {
  const hinted = fileFields.find((f) => f.looksLikeResume);
  if (hinted) return hinted.name;
  return fileFields[0]!.name;
}

function pickCoverLetterFieldName(fields: readonly ScrapedField[]): string | null {
  const textareas = fields.filter((f) => f.type === 'textarea');

  // 1. A form with a single textarea almost always has it as the cover-letter
  //    slot, regardless of name. (Apply forms rarely have multiple textareas.)
  if (textareas.length === 1) return textareas[0]!.name;

  // 2. Multiple textareas: prefer one whose name exactly equals a hint, then
  //    one whose name contains a hint, else fall through to the first one.
  if (textareas.length > 1) {
    for (const hint of COVER_LETTER_FIELD_HINTS) {
      const exact = textareas.find((t) => t.name.toLowerCase() === hint);
      if (exact) return exact.name;
    }
    for (const hint of COVER_LETTER_FIELD_HINTS) {
      const partial = textareas.find((t) => t.name.toLowerCase().includes(hint));
      if (partial) return partial.name;
    }
    return textareas[0]!.name;
  }

  // 3. No textareas in the form. Fall back to any field whose name matches —
  //    exact match first to avoid picking up hidden marker fields like
  //    `cover_letter_provided`.
  for (const hint of COVER_LETTER_FIELD_HINTS) {
    const exact = fields.find((f) => f.name.toLowerCase() === hint);
    if (exact) return exact.name;
  }
  for (const hint of COVER_LETTER_FIELD_HINTS) {
    const partial = fields.find((f) => f.name.toLowerCase().includes(hint));
    if (partial) return partial.name;
  }
  return null;
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

async function runScraperInTab(
  tabId: number,
  jobUrl: string,
  signal: AbortSignal,
  logger: Logger,
): Promise<InPageScrapeResult> {
  if (signal.aborted) {
    throw new BrightApplyError('ABORTED', 'Aborted before scraper injection.');
  }
  logger.info('Injecting scraper via chrome.scripting.executeScript', { tabId });
  let injectionResults: chrome.scripting.InjectionResult<InPageScrapeResult>[];
  try {
    injectionResults = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'ISOLATED',
      func: inPageScrapeApplyForm,
      args: [
        jobUrl,
        TIMEOUTS.formScrapeMs,
        TIMEOUTS.domPollMs,
        [...RESUME_FIELD_HINTS],
      ],
    });
  } catch (err) {
    throw new BrightApplyError(
      'CONTENT_SCRIPT_UNREACHABLE',
      `Could not inject scraper into tab: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  const first = injectionResults[0];
  if (!first || first.result === undefined || first.result === null) {
    throw new BrightApplyError(
      'CONTENT_SCRIPT_UNREACHABLE',
      'Scraper executed but returned no result. The page may have navigated.',
    );
  }
  return first.result;
}

function _typecheckPlainFormIsAssignableToScrapedForm(plain: InPagePlainForm): ScrapedForm {
  // The in-page result is a structural superset/match of ScrapedForm. This
  // unused conversion exists only to make the assumption explicit and catch
  // shape drift at compile time.
  return plain;
}
void _typecheckPlainFormIsAssignableToScrapedForm;
