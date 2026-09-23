"use client";

import { useEffect } from "react";

export function SettlementDecisionDialog({
  open,
  title,
  children,
  confirmLabel,
  pendingLabel = `${confirmLabel} 중…`,
  confirmTone = "teal",
  pending = false,
  secondaryLabel,
  onSecondary,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  confirmTone?: "teal" | "danger";
  pending?: boolean;
  /** 취소·확인 사이의 보조 액션(예: 미수금 가드의 "수납액 입력"). 라벨과 핸들러를 함께 넘길 때만 그린다. */
  secondaryLabel?: string;
  onSecondary?: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onCancel, open, pending]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-scrim p-[24px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="settlement-dialog-title"
        className="w-[420px] overflow-hidden rounded-[20px] bg-white px-[26px] pb-[24px] pt-[28px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.45)]"
      >
        <h2 id="settlement-dialog-title" className="text-[16.5px] font-extrabold leading-normal text-t1">
          {title}
        </h2>
        <div className="min-h-[54px] pt-[9px] text-[13.5px] font-medium leading-[22.275px] text-t2">
          {children}
        </div>
        <div className="flex h-[60px] items-end gap-[8px]">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="h-[40px] flex-1 rounded-[11px] border border-line bg-white text-[13.5px] font-bold text-t2 hover:bg-bg disabled:opacity-60"
          >
            취소
          </button>
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              disabled={pending}
              className="h-[40px] flex-1 rounded-[11px] border border-line bg-white text-[13.5px] font-bold text-t2 hover:bg-bg disabled:opacity-60"
            >
              {secondaryLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`h-[40px] flex-1 rounded-[11px] border text-[13.5px] font-bold text-white disabled:opacity-60 ${confirmTone === "danger" ? "border-red bg-red" : "border-teal bg-teal"}`}
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
