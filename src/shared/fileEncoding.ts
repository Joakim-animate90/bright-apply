import { MAX_RESUME_BYTES } from './constants';
import { BrightApplyError } from './errors';
import type { ResumeAttachment } from './types';

/**
 * Convert a user-picked `File` into a `ResumeAttachment` we can ship across
 * `chrome.runtime.sendMessage`. Caller must be in a browser context with
 * `FileReader` (i.e. the popup, not the service worker).
 */
export function fileToResumeAttachment(file: File): Promise<ResumeAttachment> {
  if (file.size === 0) {
    return Promise.reject(
      new BrightApplyError('UNEXPECTED', 'Resume file is empty.'),
    );
  }
  if (file.size > MAX_RESUME_BYTES) {
    return Promise.reject(
      new BrightApplyError(
        'UNEXPECTED',
        `Resume exceeds the ${formatBytes(MAX_RESUME_BYTES)} limit.`,
        { actualBytes: file.size, maxBytes: MAX_RESUME_BYTES },
      ),
    );
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new BrightApplyError('UNEXPECTED', 'Failed to read resume file.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(
          new BrightApplyError(
            'UNEXPECTED',
            'Unexpected FileReader result (expected data URL string).',
          ),
        );
        return;
      }
      const commaIdx = result.indexOf(',');
      if (commaIdx === -1) {
        reject(new BrightApplyError('UNEXPECTED', 'Malformed data URL from FileReader.'));
        return;
      }
      const base64 = result.slice(commaIdx + 1);
      resolve({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64,
        byteLength: file.size,
      });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Reconstruct a `Blob` from a `ResumeAttachment` in the service worker. We
 * intentionally do not return a `File` because the service worker does not
 * have a `File` constructor on all Chrome versions.
 */
export function resumeAttachmentToBlob(attachment: ResumeAttachment): Blob {
  const binary = atob(attachment.base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: attachment.mimeType });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
