import { useMemo } from 'react';
import { parseJobUrl } from '@/shared/url';

interface Props {
  value: string;
  disabled: boolean;
  onChange(next: string): void;
}

export function JobUrlInput({ value, disabled, onChange }: Props): JSX.Element {
  const validation = useMemo(() => {
    if (!value.trim()) return { state: 'empty' as const };
    try {
      const { url, slug } = parseJobUrl(value);
      return { state: 'valid' as const, host: url.hostname, slug };
    } catch (err) {
      return {
        state: 'invalid' as const,
        message: err instanceof Error ? err.message : 'Invalid URL.',
      };
    }
  }, [value]);

  const ringClass =
    validation.state === 'invalid'
      ? 'ring-1 ring-red-400 focus:ring-red-500'
      : validation.state === 'valid'
        ? 'ring-1 ring-emerald-300 focus:ring-emerald-500'
        : 'ring-1 ring-slate-200 focus:ring-brand-500';

  return (
    <div className="space-y-1.5">
      <label htmlFor="job-url" className="text-xs font-medium text-slate-600">
        Job URL
      </label>
      <input
        id="job-url"
        type="url"
        autoComplete="off"
        spellCheck={false}
        placeholder="https://www.brightermonday.co.ke/listings/..."
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-md border-0 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-100 ${ringClass}`}
      />
      {validation.state === 'invalid' ? (
        <p className="text-xs text-red-600">{validation.message}</p>
      ) : validation.state === 'valid' && validation.slug ? (
        <p className="text-xs text-slate-500">Detected slug: <span className="font-mono">{validation.slug}</span></p>
      ) : (
        <p className="text-xs text-slate-400">
          Paste any brightermonday.co.ke job listing URL.
        </p>
      )}
    </div>
  );
}
