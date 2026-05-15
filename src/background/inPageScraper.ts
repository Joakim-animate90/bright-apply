/**
 * Self-contained scraper executed inside the target page via
 * `chrome.scripting.executeScript({ func, args })`. The function source is
 * serialized to a string and re-evaluated in the page's isolated world, so
 * it MUST NOT reference any module-level imports, closures, or outer state.
 *
 * Anything it needs (e.g. resume-field hints) must be passed in `args`.
 */

export interface InPagePlainField {
  name: string;
  value: string;
  type: string;
  required: boolean;
}

export interface InPagePlainFileField {
  name: string;
  accept: string | null;
  required: boolean;
  looksLikeResume: boolean;
}

export interface InPagePlainForm {
  jobId: string | null;
  jobTitle: string | null;
  jobUrl: string;
  endpoint: string;
  method: 'GET' | 'POST';
  enctype: 'application/x-www-form-urlencoded' | 'multipart/form-data';
  csrfToken: string | null;
  csrfTokenFieldName: string | null;
  fields: InPagePlainField[];
  fileFields: InPagePlainFileField[];
  notes: string[];
}

export type InPageScrapeResult =
  | { ok: true; form: InPagePlainForm; href: string }
  | {
      ok: false;
      code: 'FORM_NOT_FOUND' | 'FORM_SCRAPE_TIMEOUT';
      message: string;
      href: string;
    };

export async function inPageScrapeApplyForm(
  jobUrl: string,
  timeoutMs: number,
  pollMs: number,
  resumeFieldHints: string[],
): Promise<InPageScrapeResult> {
  const APPLY_KEYWORDS = ['apply', 'application', 'job-application'];

  function resolveAbsolute(base: string, possiblyRel: string): string {
    try {
      return new URL(possiblyRel, base).toString();
    } catch {
      return possiblyRel;
    }
  }

  function findApplyForm(): HTMLFormElement | null {
    const forms = Array.from(document.querySelectorAll('form'));
    if (forms.length === 0) return null;
    for (const form of forms) {
      const action = (form.getAttribute('action') ?? '').toLowerCase();
      if (APPLY_KEYWORDS.some((k) => action.includes(k))) return form;
    }
    for (const form of forms) {
      const haystack = `${form.id} ${form.className} ${form.getAttribute('name') ?? ''}`.toLowerCase();
      if (APPLY_KEYWORDS.some((k) => haystack.includes(k))) return form;
    }
    for (const form of forms) {
      const buttons = form.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
        'button, input[type="submit"]',
      );
      for (const btn of Array.from(buttons)) {
        const label = (btn.textContent ?? (btn as HTMLInputElement).value ?? '').toLowerCase();
        if (APPLY_KEYWORDS.some((k) => label.includes(k))) return form;
      }
    }
    return null;
  }

  function findLabelText(form: HTMLFormElement, input: HTMLInputElement): string {
    if (input.id) {
      const lbl = form.querySelector<HTMLLabelElement>(`label[for="${input.id}"]`);
      if (lbl?.textContent) return lbl.textContent;
    }
    const parent = input.closest('label');
    if (parent?.textContent) return parent.textContent;
    return '';
  }

  function collectFileFields(form: HTMLFormElement): InPagePlainFileField[] {
    const inputs = Array.from(
      form.querySelectorAll<HTMLInputElement>('input[type="file"]'),
    );
    const result: InPagePlainFileField[] = [];
    for (const input of inputs) {
      const name = input.getAttribute('name');
      if (!name) continue;
      const accept = input.getAttribute('accept');
      const labelText = findLabelText(form, input).toLowerCase();
      const nameLower = name.toLowerCase();
      const looksLikeResume =
        resumeFieldHints.some((h) => nameLower.includes(h)) ||
        resumeFieldHints.some((h) => labelText.includes(h));
      result.push({
        name,
        accept: accept ?? null,
        required: input.hasAttribute('required'),
        looksLikeResume,
      });
    }
    return result;
  }

  function collectFields(form: HTMLFormElement): InPagePlainField[] {
    const seen = new Set<string>();
    const fields: InPagePlainField[] = [];
    const inputs = form.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >('input, textarea, select');
    for (const input of Array.from(inputs)) {
      const name = input.getAttribute('name');
      if (!name) continue;
      const type =
        input instanceof HTMLInputElement
          ? input.type.toLowerCase()
          : input.tagName.toLowerCase();
      if (type === 'file') continue;
      if (
        input instanceof HTMLInputElement &&
        (type === 'radio' || type === 'checkbox') &&
        !input.checked
      ) {
        continue;
      }
      const value = (input as HTMLInputElement).value ?? '';
      const dedupe = `${name}::${type}::${value}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      fields.push({
        name,
        value,
        type,
        required: input.hasAttribute('required'),
      });
    }
    return fields;
  }

  function findCsrf(fields: readonly InPagePlainField[]): {
    token: string | null;
    fieldName: string | null;
  } {
    const candidates = ['_token', 'csrf_token', 'authenticity_token', '_csrf'];
    for (const f of fields) {
      if (candidates.includes(f.name.toLowerCase()) && f.value) {
        return { token: f.value, fieldName: f.name };
      }
    }
    const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
    if (meta?.content) return { token: meta.content, fieldName: 'meta:csrf-token' };
    const xsrf = document.querySelector<HTMLMetaElement>('meta[name="xsrf-token"]');
    if (xsrf?.content) return { token: xsrf.content, fieldName: 'meta:xsrf-token' };
    return { token: null, fieldName: null };
  }

  function findJobId(
    form: HTMLFormElement,
    fields: readonly InPagePlainField[],
    url: string,
  ): string | null {
    const named = fields.find((f) => /^(job|listing|position|vacancy)_?id$/i.test(f.name));
    if (named?.value) return named.value;
    const da =
      form.getAttribute('data-job-id') ??
      form.getAttribute('data-listing-id') ??
      document.querySelector('[data-job-id]')?.getAttribute('data-job-id') ??
      document.querySelector('[data-listing-id]')?.getAttribute('data-listing-id');
    if (da) return da;
    try {
      const tail = new URL(url).pathname.split('/').filter(Boolean).pop();
      if (tail && /\d/.test(tail)) return tail;
    } catch {
      /* ignored */
    }
    return null;
  }

  function findJobTitle(): string | null {
    const h1 = document.querySelector('h1');
    if (h1?.textContent) return h1.textContent.trim().slice(0, 200);
    const og = document
      .querySelector<HTMLMetaElement>('meta[property="og:title"]')
      ?.content?.trim();
    return og ?? document.title ?? null;
  }

  function tryScrape(): InPagePlainForm | null {
    const form = findApplyForm();
    if (!form) return null;
    const action = (form.getAttribute('action') ?? '').trim();
    if (!action) return null;
    const endpoint = resolveAbsolute(window.location.href, action);
    const methodAttr = (form.getAttribute('method') ?? 'POST').toUpperCase();
    const method: 'GET' | 'POST' = methodAttr === 'GET' ? 'GET' : 'POST';
    const fileFields = collectFileFields(form);
    const enctypeAttr = (form.getAttribute('enctype') ?? '').toLowerCase();
    const enctype: InPagePlainForm['enctype'] =
      fileFields.length > 0 || enctypeAttr === 'multipart/form-data'
        ? 'multipart/form-data'
        : 'application/x-www-form-urlencoded';
    const fields = collectFields(form);
    const csrf = findCsrf(fields);
    const jobId = findJobId(form, fields, jobUrl);
    const jobTitle = findJobTitle();
    const notes: string[] = [];
    if (!csrf.token) notes.push('No CSRF token discovered — submission may be rejected.');
    if (!jobId) {
      notes.push('No explicit job_id field — relying on the apply endpoint to resolve it.');
    }
    if (fileFields.some((f) => f.required)) {
      notes.push('Apply form requires a file upload — attach a resume in the popup.');
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
      fileFields,
      notes,
    };
  }

  const immediate = tryScrape();
  if (immediate) {
    return { ok: true, form: immediate, href: window.location.href };
  }

  return new Promise<InPageScrapeResult>((resolve) => {
    let settled = false;
    const settle = (val: InPageScrapeResult): void => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearInterval(poll);
      clearTimeout(deadline);
      resolve(val);
    };

    const check = (): void => {
      try {
        const result = tryScrape();
        if (result) settle({ ok: true, form: result, href: window.location.href });
      } catch (err) {
        settle({
          ok: false,
          code: 'FORM_NOT_FOUND',
          message: err instanceof Error ? err.message : String(err),
          href: window.location.href,
        });
      }
    };

    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    const poll = setInterval(check, pollMs);
    const deadline = setTimeout(() => {
      settle({
        ok: false,
        code: 'FORM_SCRAPE_TIMEOUT',
        message: `No apply form appeared within ${timeoutMs}ms.`,
        href: window.location.href,
      });
    }, timeoutMs);
  });
}
