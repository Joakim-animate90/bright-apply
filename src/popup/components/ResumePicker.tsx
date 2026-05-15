import { useRef, type ChangeEvent, type MouseEvent } from 'react';
import {
  ACCEPTED_RESUME_MIME_TYPES,
  MAX_RESUME_BYTES,
} from '@/shared/constants';
import { BrightApplyError } from '@/shared/errors';
import { fileToResumeAttachment, formatBytes } from '@/shared/fileEncoding';
import type { ResumeAttachment } from '@/shared/types';
import type { PopupMode } from '../popupMode';

interface Props {
  resume: ResumeAttachment | null;
  error: string | null;
  disabled: boolean;
  mode: PopupMode;
  onPick(resume: ResumeAttachment): void;
  onClear(): void;
  onError(message: string): void;
  /** Called in popover mode when the user tries to open the file picker. */
  onRequireWindow(): void;
}

export function ResumePicker({
  resume,
  error,
  disabled,
  mode,
  onPick,
  onClear,
  onError,
  onRequireWindow,
}: Props): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const attachment = await fileToResumeAttachment(file);
      onPick(attachment);
    } catch (err) {
      const message =
        err instanceof BrightApplyError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to read resume.';
      onError(message);
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  // In popover mode the native file dialog would dismiss the popup and we'd
  // never see the `change` event. Intercept the click and re-launch in a
  // real window first.
  function handleLabelClick(e: MouseEvent<HTMLLabelElement>): void {
    if (mode === 'popover') {
      e.preventDefault();
      onRequireWindow();
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-600">Resume (optional)</label>
        {resume ? (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="text-xs font-medium text-slate-500 hover:text-red-600 disabled:opacity-50"
          >
            Remove
          </button>
        ) : null}
      </div>

      <label
        onClick={handleLabelClick}
        className={`flex cursor-pointer items-center justify-between gap-2 rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-xs transition hover:border-brand-500 hover:bg-brand-50 ${
          disabled ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={ACCEPTED_RESUME_MIME_TYPES.join(',')}
          disabled={disabled || mode === 'popover'}
          onChange={(e) => void handleChange(e)}
        />
        {resume ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="font-mono text-slate-500">📎</span>
            <span className="truncate font-medium text-slate-800">{resume.fileName}</span>
            <span className="shrink-0 text-slate-400">
              {formatBytes(resume.byteLength)}
            </span>
          </span>
        ) : (
          <span className="text-slate-500">
            Click to attach a resume (PDF, DOC, DOCX — max {formatBytes(MAX_RESUME_BYTES)})
          </span>
        )}
        <span className="shrink-0 text-brand-600">
          {resume ? 'Replace' : mode === 'popover' ? 'Open window' : 'Choose file'}
        </span>
      </label>

      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : mode === 'popover' && !resume ? (
        <p className="text-[11px] text-slate-400">
          Chrome closes the popup when a file dialog opens, so we&apos;ll first
          re-open BrightApply in a small window.
        </p>
      ) : null}
    </div>
  );
}
