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

/** Hard cap on resume file size we accept from the user (10 MB). */
export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

/** MIME types we accept for resume uploads. */
export const ACCEPTED_RESUME_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/rtf',
] as const;

/** Field-name fragments that hint at "this file input wants the resume". */
export const RESUME_FIELD_HINTS = ['resume', 'cv', 'curriculum'];

/**
 * Field-name fragments that mark a "cover letter / message" textarea. Order
 * matters — earlier entries win when multiple match. `description` is first
 * because BrighterMonday's apply endpoint uses that exact key.
 */
export const COVER_LETTER_FIELD_HINTS = [
  'description',
  'cover_letter',
  'coverletter',
  'cover-letter',
  'application_message',
  'message',
  'note',
];

/** Soft cap on how long a user-supplied cover letter can be. */
export const MAX_COVER_LETTER_CHARS = 4000;

/** Used when the apply form needs a cover letter but the user didn't supply one. */
export const DEFAULT_COVER_LETTER = `Dear Hiring Manager,

I am writing to express my interest in this opportunity. After reviewing the role, I believe my background, skills, and motivation make me a strong fit for what your team is looking for.

I am a quick learner who values collaboration, takes ownership of my work, and is committed to delivering quality results. I am confident I can contribute meaningfully to your organisation and grow alongside the team.

My CV is attached for your review. I would welcome the chance to discuss how I can add value to your work and look forward to hearing from you.

Kind regards,
The Applicant`;
