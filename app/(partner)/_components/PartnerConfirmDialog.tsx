"use client";

import type { ReactNode } from "react";
import { PartnerButton } from "./PartnerButton";

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
      className="fixed inset-0 z-[95] flex items-center justify-center bg-scrim p-6"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-[340px] rounded-modal bg-white px-5 pb-4 pt-[22px] text-center">
        <div className="text-[17px] font-extrabold">{title}</div>
        <div className="mt-2 text-[13.5px] font-medium leading-[1.6] text-t3">{description}</div>
        <div className="mt-5 flex gap-2">
          <PartnerButton
            variant="secondary"
            size="sm"
            type="button"
            className="flex-1"
            onClick={onCancel}
          >
            {cancelLabel}
          </PartnerButton>
          <PartnerButton
            variant={confirmVariant === "danger" ? "danger" : "primary"}
            size="sm"
            type="button"
            className="flex-1 disabled:opacity-50"
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </PartnerButton>
        </div>
      </div>
    </div>
  );
}
