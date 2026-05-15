import type { ScrapedField, ScrapedForm } from '@/shared/types';
import { resolveAbsoluteUrl } from '@/shared/url';

const APPLY_KEYWORDS = ['apply', 'application', 'job-application'];

/**
 * Searches the current document for a BrighterMonday job-application form
 * and extracts everything needed for an authenticated submission. Returns
 * `null` if no suitable form is present yet (the caller should keep waiting).
 */
export function tryScrapeApplyForm(jobUrl: string): ScrapedForm | null {
  const form = findApplyForm();
  if (!form) return null;

  const action = (form.getAttribute('action') ?? '').trim();
  if (!action) return null;

  const endpoint = resolveAbsoluteUrl(window.location.href, action);
  const methodAttr = (form.getAttribute('method') ?? 'POST').toUpperCase();
  const method: 'GET' | 'POST' = methodAttr === 'GET' ? 'GET' : 'POST';

  const enctypeAttr = (form.getAttribute('enctype') ?? '').toLowerCase();
  const enctype: ScrapedForm['enctype'] =
    enctypeAttr === 'multipart/form-data'
      ? 'multipart/form-data'
      : 'application/x-www-form-urlencoded';

  const fields = collectFields(form);
  const csrf = findCsrfToken(fields);
  const jobId = findJobId(form, fields, jobUrl);
  const jobTitle = findJobTitle();

  const notes: string[] = [];
  if (!csrf.token) {
    notes.push('No CSRF token discovered — submission may be rejected.');
  }
  if (!jobId) {
    notes.push('No explicit job_id field — relying on the apply endpoint to resolve it.');
  }

  return {
    jobId,
    jobTitle,
    jobUrl,
    endpoint,
    method,
    enctype,
    csrfToken: csrf.token,
    csrfTokenFieldName: csrf.fieldName,
    fields,
    notes,
  };
}

function findApplyForm(): HTMLFormElement | null {
  const forms = Array.from(document.querySelectorAll('form'));
  if (forms.length === 0) return null;

  // 1. Strong signal: action URL mentions apply/application.
  for (const form of forms) {
    const action = (form.getAttribute('action') ?? '').toLowerCase();
    if (APPLY_KEYWORDS.some((k) => action.includes(k))) return form;
  }
  // 2. Class / id / name hints.
  for (const form of forms) {
    const haystack =
      `${form.id} ${form.className} ${form.getAttribute('name') ?? ''}`.toLowerCase();
    if (APPLY_KEYWORDS.some((k) => haystack.includes(k))) return form;
  }
  // 3. Contains a submit button labelled "apply".
  for (const form of forms) {
    const buttons = form.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
      'button, input[type="submit"]',
    );
    for (const btn of Array.from(buttons)) {
      const label = (btn.textContent ?? btn.value ?? '').toLowerCase();
      if (APPLY_KEYWORDS.some((k) => label.includes(k))) return form;
    }
  }
  return null;
}

function collectFields(form: HTMLFormElement): ScrapedField[] {
  const seen = new Set<string>();
  const fields: ScrapedField[] = [];
  const inputs = form.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >('input, textarea, select');

  for (const input of Array.from(inputs)) {
    const name = input.getAttribute('name');
    if (!name) continue;
    const type =
      input instanceof HTMLInputElement ? input.type.toLowerCase() : input.tagName.toLowerCase();

    // Skip file inputs — we cannot stream user-selected files from a hidden tab.
    if (type === 'file') continue;
    // Skip unchecked radios/checkboxes.
    if (input instanceof HTMLInputElement && (type === 'radio' || type === 'checkbox')) {
      if (!input.checked) continue;
    }
    // De-duplicate by `name` for radios.
    const dedupeKey = `${name}::${type}::${input.value}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    fields.push({
      name,
      value: input.value ?? '',
      type,
      required: input.hasAttribute('required'),
    });
  }
  return fields;
}

function findCsrfToken(fields: readonly ScrapedField[]): {
  token: string | null;
  fieldName: string | null;
} {
  const candidateNames = ['_token', 'csrf_token', 'authenticity_token', '_csrf'];
  for (const field of fields) {
    if (candidateNames.includes(field.name.toLowerCase()) && field.value) {
      return { token: field.value, fieldName: field.name };
    }
  }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
  if (meta?.content) {
    return { token: meta.content, fieldName: 'meta:csrf-token' };
  }
  const xsrfMeta = document.querySelector<HTMLMetaElement>('meta[name="xsrf-token"]');
  if (xsrfMeta?.content) {
    return { token: xsrfMeta.content, fieldName: 'meta:xsrf-token' };
  }
  return { token: null, fieldName: null };
}

function findJobId(
  form: HTMLFormElement,
  fields: readonly ScrapedField[],
  jobUrl: string,
): string | null {
  const named = fields.find((f) => /^(job|listing|position|vacancy)_?id$/i.test(f.name));
  if (named?.value) return named.value;

  const dataAttr =
    form.getAttribute('data-job-id') ??
    form.getAttribute('data-listing-id') ??
    document.querySelector('[data-job-id]')?.getAttribute('data-job-id') ??
    document.querySelector('[data-listing-id]')?.getAttribute('data-listing-id');
  if (dataAttr) return dataAttr;

  try {
    const url = new URL(jobUrl);
    const tail = url.pathname.split('/').filter(Boolean).pop();
    if (tail && /\d/.test(tail)) return tail;
  } catch {
    /* ignored */
  }
  return null;
}

function findJobTitle(): string | null {
  const h1 = document.querySelector('h1');
  if (h1?.textContent) return h1.textContent.trim().slice(0, 200);
  const ogTitle = document
    .querySelector<HTMLMetaElement>('meta[property="og:title"]')
    ?.content?.trim();
  return ogTitle ?? document.title ?? null;
}
