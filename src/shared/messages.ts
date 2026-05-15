import type { ApplyOutcome, ScrapedForm, SessionInfo } from './types';

export type MessageType =
  | 'CHECK_SESSION'
  | 'APPLY_TO_JOB'
  | 'CANCEL_APPLY'
  | 'PING_CONTENT'
  | 'SCRAPE_APPLY_FORM';

export interface CheckSessionRequest {
  type: 'CHECK_SESSION';
}
export type CheckSessionResponse = SessionInfo;

export interface ApplyToJobRequest {
  type: 'APPLY_TO_JOB';
  jobUrl: string;
  /** Correlates popup-side cancel requests with an in-flight apply. */
  requestId: string;
}
export type ApplyToJobResponse = ApplyOutcome;

export interface CancelApplyRequest {
  type: 'CANCEL_APPLY';
  requestId: string;
}
export interface CancelApplyResponse {
  cancelled: boolean;
}

export interface PingContentRequest {
  type: 'PING_CONTENT';
}
export interface PingContentResponse {
  pong: true;
  href: string;
}

export interface ScrapeApplyFormRequest {
  type: 'SCRAPE_APPLY_FORM';
  jobUrl: string;
  /** Max time the content script is allowed to wait for the form. */
  timeoutMs: number;
}
export type ScrapeApplyFormResponse =
  | { ok: true; form: ScrapedForm }
  | { ok: false; code: string; message: string };

export type AnyRequest =
  | CheckSessionRequest
  | ApplyToJobRequest
  | CancelApplyRequest
  | PingContentRequest
  | ScrapeApplyFormRequest;

export type ResponseFor<R extends AnyRequest> = R extends CheckSessionRequest
  ? CheckSessionResponse
  : R extends ApplyToJobRequest
    ? ApplyToJobResponse
    : R extends CancelApplyRequest
      ? CancelApplyResponse
      : R extends PingContentRequest
        ? PingContentResponse
        : R extends ScrapeApplyFormRequest
          ? ScrapeApplyFormResponse
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

export function sendToTab<R extends AnyRequest>(
  tabId: number,
  request: R,
): Promise<ResponseFor<R>> {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.sendMessage(tabId, request, (response: ResponseFor<R>) => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message ?? 'tabs.sendMessage failed'));
          return;
        }
        resolve(response);
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
