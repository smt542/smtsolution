"use client";

import type { ReactNode } from "react";

type ResidentAsyncStateProps = {
  variant: "compact" | "public";
  role: "status" | "alert";
  message: ReactNode;
  showSpinner?: boolean;
  retryLabel?: ReactNode;
  onRetry?: () => void;
};

export default function ResidentAsyncState({
  variant,
  role,
  message,
  showSpinner = false,
  retryLabel,
  onRetry,
}: ResidentAsyncStateProps) {
  const containerClass = variant === "compact"
    ? "flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center text-[13px] text-t3 [&_b]:text-[17px] [&_b]:text-t1 [&_button]:h-[42px] [&_button]:rounded-in [&_button]:bg-blue [&_button]:px-[17px] [&_button]:font-extrabold [&_button]:text-white"
    : "flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10 text-center text-sm text-t3 [&_b]:text-lg [&_b]:text-t1 [&_p]:mt-2 [&_button]:mt-4 [&_button]:min-h-[42px] [&_button]:rounded-btn [&_button]:bg-blue [&_button]:px-[18px] [&_button]:font-extrabold [&_button]:text-white";

  return (
    <div
      className={containerClass}
      role={role}
      aria-label={typeof message === "string" ? message : undefined}
    >
      {showSpinner ? (
        <span className="size-[27px] animate-spin rounded-full border-[3px] border-blue-t border-t-blue" aria-hidden="true" />
      ) : null}
      {message}
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
