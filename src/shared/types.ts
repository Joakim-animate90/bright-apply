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
