import type {
  ApplyOutcome,
  ResumeAttachment,
  SessionInfo,
} from './types';

export type MessageType = 'CHECK_SESSION' | 'APPLY_TO_JOB' | 'CANCEL_APPLY';

export interface CheckSessionRequest {
  type: 'CHECK_SESSION';
}
export type CheckSessionResponse = SessionInfo;

export interface ApplyToJobRequest {
  type: 'APPLY_TO_JOB';
  jobUrl: string;
  /** Correlates popup-side cancel requests with an in-flight apply. */
  requestId: string;
  /** Optional resume the user picked in the popup. */
  resume?: ResumeAttachment;
  /**
   * Optional cover-letter text. If absent or blank, the orchestrator falls
   * back to the bundled `DEFAULT_COVER_LETTER`.
   */
  coverLetter?: string;
}
export type ApplyToJobResponse = ApplyOutcome;

export interface CancelApplyRequest {
  type: 'CANCEL_APPLY';
  requestId: string;
}
export interface CancelApplyResponse {
  cancelled: boolean;
}

export type AnyRequest =
  | CheckSessionRequest
  | ApplyToJobRequest
  | CancelApplyRequest;

export type ResponseFor<R extends AnyRequest> = R extends CheckSessionRequest
  ? CheckSessionResponse
  : R extends ApplyToJobRequest
    ? ApplyToJobResponse
    : R extends CancelApplyRequest
      ? CancelApplyResponse
      : never;

export function sendToBackground<R extends AnyRequest>(
  request: R,
): Promise<ResponseFor<R>> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(request, (response: ResponseFor<R>) => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message ?? 'runtime.sendMessage failed'));
          return;
        }
        resolve(response);
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
