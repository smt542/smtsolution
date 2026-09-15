"use client";

import type { ReactNode } from "react";

import styles from "./ResidentAsyncState.module.css";

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
  return (
    <div
      className={styles[variant]}
      role={role}
      aria-label={typeof message === "string" ? message : undefined}
    >
      {showSpinner ? (
        <span className={styles.spinner} aria-hidden="true" />
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
