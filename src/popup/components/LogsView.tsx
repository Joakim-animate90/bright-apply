import { useState } from 'react';
import { formatLogEntry } from '@/shared/logger';
import type { LogEntry } from '@/shared/types';

interface Props {
  logs: LogEntry[];
}

const LEVEL_COLOR: Record<LogEntry['level'], string> = {
  debug: 'text-slate-500',
  info: 'text-slate-700',
  warn: 'text-amber-700',
  error: 'text-red-700',
};

export function LogsView({ logs }: Props): JSX.Element | null {
  const [open, setOpen] = useState(false);
  if (logs.length === 0) return null;

  return (
    <div className="panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-xs font-semibold text-slate-600"
      >
        <span>Logs ({logs.length})</span>
        <span aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open ? (
        <ol className="mt-2 max-h-40 overflow-auto rounded border border-slate-100 bg-slate-50 p-2 font-mono text-[11px] leading-snug">
          {logs.map((entry, idx) => (
            <li
              key={`${entry.timestamp}-${idx}`}
              className={LEVEL_COLOR[entry.level]}
              title={formatLogEntry(entry)}
            >
              <span className="text-slate-400">
                {entry.timestamp.slice(11, 19)}
              </span>{' '}
              <span className="uppercase">{entry.level}</span>{' '}
              <span className="text-slate-400">({entry.scope})</span>{' '}
              {entry.message}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
