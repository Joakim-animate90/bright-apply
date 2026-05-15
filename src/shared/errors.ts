export type BrightApplyErrorCode =
  | 'INVALID_URL'
  | 'DOMAIN_NOT_ALLOWED'
  | 'NOT_LOGGED_IN'
  | 'TAB_OPEN_FAILED'
  | 'TAB_LOAD_TIMEOUT'
  | 'CONTENT_SCRIPT_UNREACHABLE'
  | 'FORM_NOT_FOUND'
  | 'FORM_SCRAPE_TIMEOUT'
  | 'ENDPOINT_NOT_FOUND'
  | 'CSRF_TOKEN_NOT_FOUND'
  | 'SUBMIT_FAILED'
  | 'SUBMIT_TIMEOUT'
  | 'SUBMIT_REJECTED'
  | 'ABORTED'
  | 'UNEXPECTED';

export class BrightApplyError extends Error {
  public readonly code: BrightApplyErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: BrightApplyErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'BrightApplyError';
    this.code = code;
    this.details = details;
  }

  public toJSON(): {
    name: string;
    code: BrightApplyErrorCode;
    message: string;
    details?: Record<string, unknown>;
  } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export function toBrightApplyError(unknown: unknown): BrightApplyError {
  if (unknown instanceof BrightApplyError) return unknown;
  if (unknown instanceof DOMException && unknown.name === 'AbortError') {
    return new BrightApplyError('ABORTED', 'Operation aborted.');
  }
  if (unknown instanceof Error) {
    return new BrightApplyError('UNEXPECTED', unknown.message, {
      stack: unknown.stack,
    });
  }
  return new BrightApplyError('UNEXPECTED', String(unknown));
}
