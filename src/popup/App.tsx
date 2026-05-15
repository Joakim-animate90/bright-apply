import { useCallback, useEffect, useRef } from 'react';
import { TIMEOUTS } from '@/shared/constants';
import { createLogger } from '@/shared/logger';
import { sendToBackground } from '@/shared/messages';
import type { LogEntry } from '@/shared/types';
import { parseJobUrl } from '@/shared/url';
import { ApplyButton } from './components/ApplyButton';
import { JobUrlInput } from './components/JobUrlInput';
import { LogsView } from './components/LogsView';
import { ResultPanel } from './components/ResultPanel';
import { StatusBadge } from './components/StatusBadge';
import { usePopupStore } from './store';

const popupLogger = createLogger('popup');

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function App(): JSX.Element {
  const {
    jobUrl,
    sessionStatus,
    isCheckingSession,
    isApplying,
    currentRequestId,
    result,
    failure,
    logs,
    setJobUrl,
    setSession,
    setCheckingSession,
    startApply,
    finishApply,
    appendLogs,
  } = usePopupStore();

  const responseTimeoutRef = useRef<number | null>(null);

  const refreshSession = useCallback(async () => {
    setCheckingSession(true);
    popupLogger.info('Checking session');
    try {
      const info = await sendToBackground({ type: 'CHECK_SESSION' });
      setSession(info);
    } catch (err) {
      popupLogger.error('Session check failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      setSession({
        status: 'unknown',
        detectedCookies: [],
        checkedAt: new Date().toISOString(),
      });
    } finally {
      setCheckingSession(false);
    }
  }, [setCheckingSession, setSession]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const handleApply = useCallback(async () => {
    let valid = false;
    try {
      parseJobUrl(jobUrl);
      valid = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid URL.';
      finishApply({
        failure: { code: 'INVALID_URL', message },
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: 'error',
            scope: 'popup',
            message,
          } satisfies LogEntry,
        ],
      });
    }
    if (!valid) return;

    const requestId = generateRequestId();
    startApply(requestId);
    popupLogger.info('Apply requested', { requestId, jobUrl });

    if (responseTimeoutRef.current !== null) {
      window.clearTimeout(responseTimeoutRef.current);
    }
    const timeoutHandle = window.setTimeout(() => {
      popupLogger.warn('Popup-side response timeout reached', {
        timeoutMs: TIMEOUTS.popupResponseMs,
      });
      void sendToBackground({ type: 'CANCEL_APPLY', requestId });
      finishApply({
        failure: {
          code: 'SUBMIT_TIMEOUT',
          message: `No response from background within ${TIMEOUTS.popupResponseMs}ms.`,
        },
        logs: popupLogger.entries() as LogEntry[],
      });
    }, TIMEOUTS.popupResponseMs);
    responseTimeoutRef.current = timeoutHandle;

    try {
      const outcome = await sendToBackground({
        type: 'APPLY_TO_JOB',
        jobUrl,
        requestId,
      });
      window.clearTimeout(timeoutHandle);
      responseTimeoutRef.current = null;
      if (outcome.ok) {
        finishApply({ result: outcome.summary, logs: outcome.logs });
        popupLogger.info('Apply succeeded', {
          endpoint: outcome.summary.endpoint,
          httpStatus: outcome.summary.httpStatus,
        });
      } else {
        finishApply({ failure: outcome.failure, logs: outcome.logs });
        popupLogger.warn('Apply failed', {
          code: outcome.failure.code,
          message: outcome.failure.message,
        });
      }
      appendLogs(popupLogger.entries() as LogEntry[]);
    } catch (err) {
      window.clearTimeout(timeoutHandle);
      responseTimeoutRef.current = null;
      const message = err instanceof Error ? err.message : String(err);
      popupLogger.error('sendMessage failed', { error: message });
      finishApply({
        failure: { code: 'UNEXPECTED', message },
        logs: popupLogger.entries() as LogEntry[],
      });
    }
  }, [appendLogs, finishApply, jobUrl, startApply]);

  const handleCancel = useCallback(async () => {
    if (!currentRequestId) return;
    popupLogger.info('Cancel requested', { requestId: currentRequestId });
    try {
      await sendToBackground({ type: 'CANCEL_APPLY', requestId: currentRequestId });
    } catch (err) {
      popupLogger.warn('Cancel message failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [currentRequestId]);

  const canApply = jobUrl.trim().length > 0 && sessionStatus === 'loggedIn';

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            BrightApply
          </h1>
          <p className="text-[11px] text-slate-500">
            One-click apply on BrighterMonday
          </p>
        </div>
      </header>

      <StatusBadge
        status={sessionStatus}
        checking={isCheckingSession}
        onRefresh={() => void refreshSession()}
      />

      {sessionStatus === 'loggedOut' ? (
        <div className="panel border-amber-200 bg-amber-50 text-xs text-amber-800">
          You are not logged into BrighterMonday in this browser.{' '}
          <a
            href="https://www.brightermonday.co.ke/login"
            target="_blank"
            rel="noreferrer noopener"
            className="font-semibold underline"
          >
            Sign in
          </a>{' '}
          and then refresh status.
        </div>
      ) : null}

      <JobUrlInput
        value={jobUrl}
        disabled={isApplying}
        onChange={setJobUrl}
      />

      <ApplyButton
        isApplying={isApplying}
        canApply={canApply}
        onApply={() => void handleApply()}
        onCancel={() => void handleCancel()}
      />

      <ResultPanel result={result} failure={failure} />
      <LogsView logs={logs} />

      <footer className="mt-auto pt-2 text-center text-[10px] text-slate-400">
        BrightApply v{chrome.runtime.getManifest().version} — uses your existing
        browser session. Cookies stay in the browser.
      </footer>
    </div>
  );
}
