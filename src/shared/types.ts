import type { BrightApplyErrorCode } from './errors';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  scope: 'popup' | 'background' | 'content';
  context?: Record<string, unknown>;
}

export type SessionStatus = 'unknown' | 'loggedIn' | 'loggedOut';

export interface SessionInfo {
  status: SessionStatus;
  /** Names of the cookies we found (never the values). */
  detectedCookies: string[];
  checkedAt: string;
}

export interface ScrapedField {
  name: string;
  /** Raw value present in the DOM. Sensitive values are redacted before display. */
  value: string;
  type: string;
  required: boolean;
}

export interface ScrapedFileField {
  name: string;
  accept: string | null;
  required: boolean;
  /** True if the field's name or surrounding label suggests it wants a resume/CV. */
  looksLikeResume: boolean;
}

/**
 * Resume bytes carried from popup → background. We use base64 because
 * `chrome.runtime.sendMessage` only round-trips structured-clonable data
 * cleanly across all Chrome versions, and a string is the safest currency.
 */
export interface ResumeAttachment {
  fileName: string;
  mimeType: string;
  /** Raw bytes, base64-encoded (no `data:` prefix). */
  base64: string;
  /** Decoded byte length, for quota checks. */
  byteLength: number;
}

export interface ScrapedForm {
  jobId: string | null;
  jobTitle: string | null;
  jobUrl: string;
  endpoint: string;
  method: 'GET' | 'POST';
  enctype: 'application/x-www-form-urlencoded' | 'multipart/form-data';
  csrfToken: string | null;
  csrfTokenFieldName: string | null;
  fields: ScrapedField[];
  fileFields: ScrapedFileField[];
  notes: string[];
}

export interface ApplyAttemptSummary {
  jobUrl: string;
  endpoint: string;
  method: 'GET' | 'POST';
  status: 'success' | 'failed';
  httpStatus: number | null;
  /** Sanitized, human-readable payload preview (sensitive fields redacted). */
  payloadPreview: Record<string, string>;
  /** Short snippet of the response body (truncated). */
  responseSnippet: string | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface ApplyFailure {
  code: BrightApplyErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type ApplyOutcome =
  | { ok: true; summary: ApplyAttemptSummary; logs: LogEntry[] }
  | { ok: false; failure: ApplyFailure; logs: LogEntry[] };
