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
  /** 프로필처럼 정본이 작은형 `.cf`인 화면. 기본은 표준형이다. */
  compact?: boolean;
};

/**
 * 정본 확인창 `.cf`는 두 규격이다.
 * - 표준형: AS 상세·AS 접수·검침·이사정산 등록 — 폭 360, 버튼 48px, 설명 14px `--t2`
 * - 작은형: 프로필 — 폭 330, 버튼 46px, 설명 13.5px `--t3`
 */
const LAYOUT = {
  standard: {
    scrim: "z-[120]",
    box: "max-w-[360px] px-[22px] pb-[18px] pt-6",
    title: "tracking-[-0.01em]",
    desc: "text-sm text-t2",
    actions: "mt-[22px]",
    button: "md",
  },
  compact: {
    scrim: "z-[95]",
    box: "max-w-[330px] px-5 pb-4 pt-[22px]",
    title: "",
    desc: "text-[13.5px] text-t3",
    actions: "mt-5",
    button: "sm",
  },
} as const;

export function PartnerConfirmDialog({
  title,
  description,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  confirmVariant = "ok",
  confirmDisabled,
  compact = false,
}: PartnerConfirmDialogProps) {
  const layout = compact ? LAYOUT.compact : LAYOUT.standard;
  return (
    <div
      className={`fixed inset-0 ${layout.scrim} flex items-center justify-center bg-scrim p-6`}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className={`w-full ${layout.box} rounded-modal bg-white text-center`}>
        <div className={`text-[17px] font-extrabold ${layout.title}`}>{title}</div>
        <div className={`mt-2 font-medium leading-[1.6] ${layout.desc}`}>{description}</div>
        <div className={`${layout.actions} flex gap-2`}>
          <PartnerButton
            variant="secondary"
            size={layout.button}
            type="button"
            className="flex-1"
            onClick={onCancel}
          >
            {cancelLabel}
          </PartnerButton>
          <PartnerButton
            variant={confirmVariant === "danger" ? "danger" : "primary"}
            size={layout.button}
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
