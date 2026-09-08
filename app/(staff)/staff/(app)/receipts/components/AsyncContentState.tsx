import { Spinner } from "@/components/common";

interface AsyncContentStateProps {
  error?: boolean;
  errorMessage?: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Shared loading / error / empty state block for the receipts report-preview
 * modals (charge report, monthly charge, unit statement, villa overdue,
 * villa receipt history). Reproduces the `min-h-0 flex-1 overflow-auto`
 * scroll container and the centered state markup those modals previously
 * inlined; only one of error / loading / empty should be set at a time.
 */
export function AsyncContentState({
  error = false,
  errorMessage,
  loading = false,
  empty = false,
  emptyMessage,
  children,
}: AsyncContentStateProps) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      {error ? (
        <div className="flex h-full items-center justify-center text-sm font-bold text-red">
          {errorMessage}
        </div>
      ) : loading ? (
        <div className="flex h-full items-center justify-center">
          <Spinner />
        </div>
      ) : empty ? (
        <div className="flex h-full items-center justify-center text-sm text-t3">
          {emptyMessage}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
