import type { SessionStatus } from '@/shared/types';
import { Spinner } from './Spinner';

interface Props {
  status: SessionStatus;
  checking: boolean;
  onRefresh(): void;
}

export function StatusBadge({ status, checking, onRefresh }: Props): JSX.Element {
  const label = checking
    ? 'Checking…'
    : status === 'loggedIn'
      ? 'Logged In'
      : status === 'loggedOut'
        ? 'Not Logged In'
        : 'Unknown';

  const tone =
    status === 'loggedIn'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'loggedOut'
        ? 'bg-red-100 text-red-800'
        : 'bg-slate-200 text-slate-700';

  return (
    <div className="flex items-center justify-between">
      <span className={`badge ${tone}`}>
        {checking ? (
          <Spinner className="text-current" />
        ) : (
          <span
            aria-hidden
            className={`h-2 w-2 rounded-full ${
              status === 'loggedIn'
                ? 'bg-emerald-500'
                : status === 'loggedOut'
                  ? 'bg-red-500'
                  : 'bg-slate-400'
            }`}
          />
        )}
        {label}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={checking}
        className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
      >
        Refresh
      </button>
    </div>
  );
}
