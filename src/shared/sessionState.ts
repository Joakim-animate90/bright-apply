import type { ResumeAttachment } from './types';

const SESSION_STATE_KEY = 'brightapply:popup-state';

export interface PopupSessionState {
  jobUrl: string;
  resume: ResumeAttachment | null;
  coverLetter: string;
}

/**
 * Persist transient popup state so it survives the popover→window transition
 * (Chrome closes the action popover the moment focus leaves it — e.g. when
 * the native file picker dialog opens). `chrome.storage.session` is in-memory
 * and cleared on browser restart, which is exactly the lifetime we want here.
 */
export async function savePopupSessionState(
  state: PopupSessionState,
): Promise<void> {
  await chrome.storage.session.set({ [SESSION_STATE_KEY]: state });
}

export async function loadPopupSessionState(): Promise<PopupSessionState | null> {
  const result = await chrome.storage.session.get(SESSION_STATE_KEY);
  const value = result[SESSION_STATE_KEY];
  if (!value || typeof value !== 'object') return null;
  return value as PopupSessionState;
}

export async function clearPopupSessionState(): Promise<void> {
  await chrome.storage.session.remove(SESSION_STATE_KEY);
}
