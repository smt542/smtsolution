"use client";

import type { ReactNode } from "react";

import styles from "./PartnerConfirmDialog.module.css";

type PartnerConfirmDialogProps = {
  title: ReactNode;
  description: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  /** Cancel button and backdrop dismiss share one handler at every call site. */
  onCancel: () => void;
  onConfirm: () => void;
  confirmVariant?: "ok" | "danger";
  confirmDisabled?: boolean;
};

export function PartnerConfirmDialog({
  title,
  description,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  confirmVariant = "ok",
  confirmDisabled,
}: PartnerConfirmDialogProps) {
  return (
    <div
      className={styles.scrim}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className={styles.dialog}>
        <div className={styles.dTitle}>{title}</div>
        <div className={styles.dDesc}>{description}</div>
        <div className={styles.dActions}>
          <button
            type="button"
            className={`${styles.dBtn} ${styles.dCancel}`}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${styles.dBtn} ${confirmVariant === "danger" ? styles.dDanger : styles.dOk}`}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
