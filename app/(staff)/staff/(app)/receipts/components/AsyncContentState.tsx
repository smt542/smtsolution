import { Spinner } from "@/components/common";

interface AsyncContentStateProps {
  error?: boolean;
  errorMessage?: React.ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  refreshing?: boolean;
  refreshingLabel?: string;
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
  errorMessage = "자료를 불러오지 못했습니다.",
  loading = false,
  loadingLabel = "자료를 불러오는 중",
  refreshing = false,
  refreshingLabel = "자료 갱신 중",
  empty = false,
  emptyMessage,
  children,
}: AsyncContentStateProps) {
  return (
    <div className="relative min-h-0 flex-1 overflow-auto">
      {error ? (
        <div role="alert" className="flex h-full items-center justify-center text-sm font-bold text-red">
          {errorMessage}
        </div>
      ) : loading ? (
        <div className="flex h-full items-center justify-center">
          <Spinner label={loadingLabel} />
        </div>
      ) : empty ? (
        <div className="flex h-full items-center justify-center text-sm text-t3">
          {emptyMessage}
        </div>
      ) : (
        <>
          {children}
          {refreshing ? (
            <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-surface/95 shadow-card">
              <Spinner
                label={refreshingLabel}
                size="small"
                showLabel
                className="px-3 py-2"
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
