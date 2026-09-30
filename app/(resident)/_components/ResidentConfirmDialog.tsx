"use client";

import { useEffect, useId, type ReactNode } from "react";

import { ResidentButton } from "@/app/(resident)/_components/ResidentButton";

/**
 * 세입자 앱 확인창 — 원본 `.cf`(resident-me 로그아웃·탈퇴·알림톡 끄기, resident-home 퇴실 신청 취소).
 * 바깥을 누르거나 Esc를 누르면 닫는다(`cancelDisabled` 동안은 막음). Esc는 window 캡처 단계에서 받아 멈춘다 —
 * 아래에 깔린 바텀시트(document에서 Esc를 받음)가 같이 닫히지 않게.
 */
type ResidentConfirmDialogProps = {
  open: boolean;
  title: ReactNode;
  description: ReactNode;
  error?: ReactNode;
  cancelLabel?: string;
  confirmLabel: ReactNode;
  tone?: "primary" | "danger";
  /** 확인 버튼 비활성(처리 중) */
  busy?: boolean;
  /** 닫기 버튼·바깥 누름·Esc 막음(처리 중 닫으면 안 되는 경우) */
  cancelDisabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const classes = {
  scrim: "fixed inset-0 z-[130] flex items-center justify-center bg-scrim p-[26px]",
  body: "box-border w-full max-w-[340px] rounded-[20px] bg-white px-[22px] pb-5 pt-[26px] text-center",
  title: "m-0 text-[17.5px] font-extrabold leading-[1.45] tracking-[-0.02em]",
  description: "mt-[9px] text-[13.5px] font-semibold leading-[1.65] text-t3 [text-wrap:pretty] [&_b]:font-extrabold [&_b]:text-t1",
  error: "mt-3 text-[12.5px] font-bold text-red",
  actions: "mt-[22px] flex gap-[9px]",
  button: "flex-1 disabled:cursor-wait disabled:opacity-60",
} as const;

export default function ResidentConfirmDialog({
  open,
  title,
  description,
  error,
  cancelLabel = "닫기",
  confirmLabel,
  tone = "primary",
  busy = false,
  cancelDisabled = false,
  onCancel,
  onConfirm,
}: ResidentConfirmDialogProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      if (!cancelDisabled) onCancel();
    };
    window.addEventListener("keydown", onEscape, true);
    return () => window.removeEventListener("keydown", onEscape, true);
  }, [open, cancelDisabled, onCancel]);

  if (!open) return null;

  return (
    <div
      className={classes.scrim}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget && !cancelDisabled) onCancel();
      }}
    >
      <div className={classes.body}>
        <h2 className={classes.title} id={titleId}>
          {title}
        </h2>
        <p className={classes.description}>{description}</p>
        {error ? (
          <p className={classes.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={classes.actions}>
          <ResidentButton
            variant="secondary"
            size="md"
            type="button"
            className={classes.button}
            disabled={cancelDisabled}
            onClick={onCancel}
          >
            {cancelLabel}
          </ResidentButton>
          <ResidentButton
            variant={tone}
            size="md"
            type="button"
            className={classes.button}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </ResidentButton>
        </div>
      </div>
    </div>
  );
}
