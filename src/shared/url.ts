import { ALLOWED_HOST_SUFFIX } from './constants';
import { BrightApplyError } from './errors';

export interface ParsedJobUrl {
  url: URL;
  /** Best-effort job slug parsed from the path. */
  slug: string | null;
}

export function parseJobUrl(raw: string): ParsedJobUrl {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new BrightApplyError('INVALID_URL', 'The job URL is not a valid URL.');
  }
  if (url.protocol !== 'https:') {
    throw new BrightApplyError(
      'INVALID_URL',
      'Job URL must use https:// — refusing to load over insecure transport.',
    );
  }
  if (!isAllowedHost(url.hostname)) {
    throw new BrightApplyError(
      'DOMAIN_NOT_ALLOWED',
      `Only brightermonday.co.ke URLs are accepted (got "${url.hostname}").`,
    );
  }
  const slug = extractSlug(url);
  return { url, slug };
}

export function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'brightermonday.co.ke' ||
    host === 'www.brightermonday.co.ke' ||
    host.endsWith(ALLOWED_HOST_SUFFIX)
  );
}

function extractSlug(url: URL): string | null {
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  return parts[parts.length - 1] ?? null;
}

export function resolveAbsoluteUrl(base: string, possiblyRelative: string): string {
  try {
    return new URL(possiblyRelative, base).toString();
  } catch {
    return possiblyRelative;
  }
}
