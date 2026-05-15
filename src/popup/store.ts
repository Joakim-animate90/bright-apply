import { create } from 'zustand';
import type {
  ApplyAttemptSummary,
  ApplyFailure,
  LogEntry,
  ResumeAttachment,
  SessionInfo,
} from '@/shared/types';

export interface PopupState {
  jobUrl: string;
  sessionStatus: SessionInfo['status'];
  detectedCookies: string[];
  sessionCheckedAt: string | null;
  isApplying: boolean;
  isCheckingSession: boolean;
  currentRequestId: string | null;
  result: ApplyAttemptSummary | null;
  failure: ApplyFailure | null;
  logs: LogEntry[];
  resume: ResumeAttachment | null;
  resumeError: string | null;
  coverLetter: string;
  setJobUrl(url: string): void;
  setSession(info: SessionInfo): void;
  setCheckingSession(checking: boolean): void;
  startApply(requestId: string): void;
  finishApply(payload: {
    result?: ApplyAttemptSummary;
    failure?: ApplyFailure;
    logs: LogEntry[];
  }): void;
  appendLogs(logs: LogEntry[]): void;
  setResume(resume: ResumeAttachment | null): void;
  setResumeError(message: string | null): void;
  setCoverLetter(text: string): void;
  reset(): void;
}

export const usePopupStore = create<PopupState>((set) => ({
  jobUrl: '',
  sessionStatus: 'unknown',
  detectedCookies: [],
  sessionCheckedAt: null,
  isApplying: false,
  isCheckingSession: false,
  currentRequestId: null,
  result: null,
  failure: null,
  logs: [],
  resume: null,
  resumeError: null,
  coverLetter: '',
  setJobUrl(url) {
    set({ jobUrl: url });
  },
  setSession(info) {
    set({
      sessionStatus: info.status,
      detectedCookies: info.detectedCookies,
      sessionCheckedAt: info.checkedAt,
    });
  },
  setCheckingSession(checking) {
    set({ isCheckingSession: checking });
  },
  startApply(requestId) {
    set({
      isApplying: true,
      currentRequestId: requestId,
      result: null,
      failure: null,
      logs: [],
    });
  },
  finishApply({ result, failure, logs }) {
    set({
      isApplying: false,
      currentRequestId: null,
      result: result ?? null,
      failure: failure ?? null,
      logs,
    });
  },
  appendLogs(logs) {
    set((state) => ({ logs: [...state.logs, ...logs] }));
  },
  setResume(resume) {
    set({ resume, resumeError: null });
  },
  setResumeError(message) {
    set({ resumeError: message });
  },
  setCoverLetter(text) {
    set({ coverLetter: text });
  },
  reset() {
    set({
      result: null,
      failure: null,
      logs: [],
      isApplying: false,
      currentRequestId: null,
    });
  },
}));
