import { ALLOWED_DOMAINS, KNOWN_SESSION_COOKIES } from '@/shared/constants';
import type { Logger } from '@/shared/logger';
import type { SessionInfo } from '@/shared/types';

/**
 * Determines whether the user currently has an authenticated BrighterMonday
 * session. We do this by inspecting the browser's cookie jar via the
 * `chrome.cookies` API — we never read cookie *values*, only check presence
 * of session-style cookie names.
 */
export async function checkSession(logger: Logger): Promise<SessionInfo> {
  const detected = new Set<string>();

  for (const domain of ALLOWED_DOMAINS) {
    let cookies: chrome.cookies.Cookie[] = [];
    try {
      cookies = await chrome.cookies.getAll({ domain });
    } catch (error) {
      logger.warn('cookies.getAll failed', {
        domain,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    for (const cookie of cookies) {
      if (cookie.value && cookie.value.length > 0) {
        if (isSessionCookieName(cookie.name)) {
          detected.add(cookie.name);
        }
      }
    }
  }

  const detectedCookies = Array.from(detected).sort();
  const status: SessionInfo['status'] =
    detectedCookies.length > 0 ? 'loggedIn' : 'loggedOut';

  logger.info('Session check complete', {
    status,
    detectedCookieCount: detectedCookies.length,
  });

  return {
    status,
    detectedCookies,
    checkedAt: new Date().toISOString(),
  };
}

function isSessionCookieName(name: string): boolean {
  const lower = name.toLowerCase();
  return KNOWN_SESSION_COOKIES.some(
    (known) => lower === known.toLowerCase() || lower.includes(known.toLowerCase()),
  );
}
