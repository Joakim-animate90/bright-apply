export const EXTENSION_NAME = 'BrightApply';

export const ALLOWED_DOMAINS = [
  'brightermonday.co.ke',
  'www.brightermonday.co.ke',
] as const;

export const ALLOWED_HOST_SUFFIX = '.brightermonday.co.ke';

export const TIMEOUTS = {
  /** Maximum time we wait for a background tab to finish loading. */
  tabLoadMs: 25_000,
  /** Maximum time the content script will wait for an apply form to appear. */
  formScrapeMs: 20_000,
  /** Maximum time a single fetch (e.g. apply submission) is allowed to run. */
  fetchMs: 30_000,
  /** Maximum time the popup will wait for the background's final response. */
  popupResponseMs: 90_000,
  /** Polling interval used inside the content-script DOM waiter. */
  domPollMs: 250,
} as const;

/** Cookie names commonly associated with logged-in BrighterMonday sessions. */
export const KNOWN_SESSION_COOKIES = [
  'laravel_session',
  'XSRF-TOKEN',
  'bm_session',
  'remember_web',
  'access_token',
  'token',
] as const;

/** Field-name fragments that should be redacted from any rendered payload. */
export const SENSITIVE_FIELD_FRAGMENTS = [
  'password',
  'secret',
  'token',
  'csrf',
  'authorization',
  'auth',
  'cookie',
  'session',
  'api_key',
  'apikey',
];

export const MAX_LOG_ENTRIES = 200;
