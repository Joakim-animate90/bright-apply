import { Spinner } from './Spinner';

interface Props {
  isApplying: boolean;
  canApply: boolean;
  onApply(): void;
  onCancel(): void;
}

export function ApplyButton({
  isApplying,
  canApply,
  onApply,
  onCancel,
}: Props): JSX.Element {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onApply}
        disabled={isApplying || !canApply}
        className="btn-primary flex-1"
      >
        {isApplying ? (
          <>
            <Spinner /> Applying…
          </>
        ) : (
          'Apply'
        )}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={!isApplying}
        className="btn-secondary"
      >
        Cancel
      </button>
    </div>
  );
}
