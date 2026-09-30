"use client";

import type { ReactNode } from "react";
import { PartnerButton } from "./PartnerButton";

type PartnerConfirmDialogProps = {
  title: ReactNode;
  description: ReactNode;
  /** 없으면 확인 버튼 하나만 둔다(정본 검침 급증 알림처럼 취소를 숨긴 `.cf`). */
  cancelLabel?: string;
  confirmLabel: string;
  /** Cancel button and backdrop dismiss share one handler at every call site. */
  onCancel: () => void;
  onConfirm: () => void;
  confirmVariant?: "ok" | "danger";
  confirmDisabled?: boolean;
  /** 프로필처럼 정본이 작은형 `.cf`인 화면. 기본은 표준형이다. */
  compact?: boolean;
  /** 제목 위 경고 아이콘(정본 `.cf-ico`: 48px 연빨강 원). */
  icon?: "warning";
};

function WarningIcon() {
  return (
    <div className="mx-auto mb-3.5 flex size-12 items-center justify-center rounded-full bg-red-t text-red" aria-hidden="true">
      <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4l9 16H3z" />
        <path d="M12 10.5v4M12 17.2v.6" />
      </svg>
    </div>
  );
}

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
  icon,
}: PartnerConfirmDialogProps) {
  const layout = compact ? LAYOUT.compact : LAYOUT.standard;
  return (
    <div
      className={`fixed inset-0 ${layout.scrim} flex items-center justify-center bg-scrim p-6`}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className={`w-full ${layout.box} rounded-modal bg-white text-center`}>
        {icon === "warning" && <WarningIcon />}
        <div className={`text-[17px] font-extrabold ${layout.title}`}>{title}</div>
        <div className={`mt-2 font-medium leading-[1.6] ${layout.desc}`}>{description}</div>
        <div className={`${layout.actions} flex gap-2`}>
          {cancelLabel !== undefined && (
            <PartnerButton
              variant="secondary"
              size={layout.button}
              type="button"
              className="flex-1"
              onClick={onCancel}
            >
              {cancelLabel}
            </PartnerButton>
          )}
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
