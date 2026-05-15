import type { ApplyAttemptSummary, ApplyFailure } from '@/shared/types';

interface Props {
  result: ApplyAttemptSummary | null;
  failure: ApplyFailure | null;
}

export function ResultPanel({ result, failure }: Props): JSX.Element | null {
  if (!result && !failure) return null;

  if (failure) {
    return (
      <div className="panel border-red-200 bg-red-50">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-red-700">Apply failed</h2>
          <code className="text-[11px] text-red-600">{failure.code}</code>
        </header>
        <p className="mt-1 text-xs text-red-700">{failure.message}</p>
        {failure.details ? (
          <pre className="mt-2 max-h-32 overflow-auto rounded bg-white/60 p-2 font-mono text-[10px] text-red-800">
            {JSON.stringify(failure.details, null, 2)}
          </pre>
        ) : null}
      </div>
    );
  }

  if (!result) return null;
  return (
    <div className="panel border-emerald-200 bg-emerald-50">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-emerald-800">Application submitted</h2>
        <code className="text-[11px] text-emerald-700">HTTP {result.httpStatus ?? '—'}</code>
      </header>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-700">
        <dt className="col-span-1 font-medium">Endpoint</dt>
        <dd className="col-span-2 truncate font-mono" title={result.endpoint}>
          {result.endpoint}
        </dd>
        <dt className="col-span-1 font-medium">Method</dt>
        <dd className="col-span-2 font-mono">{result.method}</dd>
        <dt className="col-span-1 font-medium">Duration</dt>
        <dd className="col-span-2">{result.durationMs} ms</dd>
      </dl>
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] font-semibold text-emerald-800">
          Payload preview (sensitive fields redacted)
        </summary>
        <pre className="mt-1 max-h-32 overflow-auto rounded bg-white/60 p-2 font-mono text-[10px]">
          {JSON.stringify(result.payloadPreview, null, 2)}
        </pre>
      </details>
      {result.responseSnippet ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] font-semibold text-emerald-800">
            Response snippet
          </summary>
          <pre className="mt-1 max-h-32 overflow-auto rounded bg-white/60 p-2 font-mono text-[10px]">
            {result.responseSnippet}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
