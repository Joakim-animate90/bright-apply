import {
  loadPopupSessionState,
  savePopupSessionState,
  type PopupSessionState,
} from '@/shared/sessionState';

export type PopupMode = 'popover' | 'windowed';

const WINDOWED_FLAG = 'windowed';

export function getPopupMode(): PopupMode {
  if (typeof window === 'undefined') return 'popover';
  return new URLSearchParams(window.location.search).get(WINDOWED_FLAG) === '1'
    ? 'windowed'
    : 'popover';
}

/**
 * Re-launch the popup as a real popup *window* (which doesn't close on blur)
 * and dismiss the current action-popover. Saves transient state first so it
 * carries over.
 */
export async function openInWindow(state: PopupSessionState): Promise<void> {
  await savePopupSessionState(state);
  const url = chrome.runtime.getURL(`index.html?${WINDOWED_FLAG}=1`);
  await chrome.windows.create({
    url,
    type: 'popup',
    width: 420,
    height: 720,
    focused: true,
  });
  window.close();
}

export async function restoreSessionState(): Promise<PopupSessionState | null> {
  return loadPopupSessionState();
}
