import { useMemo } from 'react';
import {
  DEFAULT_COVER_LETTER,
  MAX_COVER_LETTER_CHARS,
} from '@/shared/constants';

interface Props {
  value: string;
  disabled: boolean;
  onChange(next: string): void;
}

export function CoverLetterEditor({ value, disabled, onChange }: Props): JSX.Element {
  const trimmed = useMemo(() => value.trim(), [value]);
  const usingDefault = trimmed.length === 0;
  const overLimit = value.length > MAX_COVER_LETTER_CHARS;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor="cover-letter" className="text-xs font-medium text-slate-600">
          Cover letter (optional)
        </label>
        <div className="flex items-center gap-2">
          {usingDefault ? (
            <button
              type="button"
              onClick={() => onChange(DEFAULT_COVER_LETTER)}
              disabled={disabled}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
              title="Pre-fill the textarea with the generic cover letter so you can tweak it."
            >
              Use generic
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onChange('')}
              disabled={disabled}
              className="text-xs font-medium text-slate-500 hover:text-red-600 disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <textarea
        id="cover-letter"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Leave blank to send a generic cover letter, or paste/write your own."
        rows={5}
        spellCheck
        className={`block w-full resize-y rounded-md border-0 bg-white px-3 py-2 font-mono text-[11px] leading-snug text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-100 ${
          overLimit
            ? 'ring-1 ring-red-400 focus:ring-red-500'
            : 'ring-1 ring-slate-200 focus:ring-brand-500'
        }`}
      />

      <div className="flex items-center justify-between text-[11px]">
        <span className={usingDefault ? 'text-slate-400' : 'text-slate-500'}>
          {usingDefault
            ? 'Will send the bundled generic cover letter.'
            : 'Will send your custom text.'}
        </span>
        <span className={overLimit ? 'font-semibold text-red-600' : 'text-slate-400'}>
          {value.length}/{MAX_COVER_LETTER_CHARS}
        </span>
      </div>
    </div>
  );
}
