import { createLogger } from '@/shared/logger';
import type { AnyRequest } from '@/shared/messages';
import { checkSession } from './session';
import { applyToJob, cancelApply } from './orchestrator';

const bootLogger = createLogger('background');
bootLogger.info('Service worker booted', {
  version: chrome.runtime.getManifest().version,
});

chrome.runtime.onInstalled.addListener((details) => {
  bootLogger.info('onInstalled', { reason: details.reason });
});

chrome.runtime.onMessage.addListener(
  (message: AnyRequest, _sender, sendResponse) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err) => {
        bootLogger.error('Message handler threw', {
          error: err instanceof Error ? err.message : String(err),
        });
        sendResponse({
          ok: false,
          failure: {
            code: 'UNEXPECTED',
            message: err instanceof Error ? err.message : String(err),
          },
          logs: [],
        });
      });
    // Indicates asynchronous sendResponse.
    return true;
  },
);

async function handleMessage(message: AnyRequest): Promise<unknown> {
  switch (message.type) {
    case 'CHECK_SESSION': {
      const logger = createLogger('background');
      return checkSession(logger);
    }
    case 'APPLY_TO_JOB': {
      return applyToJob(message.jobUrl, message.requestId);
    }
    case 'CANCEL_APPLY': {
      const cancelled = cancelApply(message.requestId);
      return { cancelled };
    }
    default: {
      throw new Error(`Unsupported message type: ${(message as { type: string }).type}`);
    }
  }
}
