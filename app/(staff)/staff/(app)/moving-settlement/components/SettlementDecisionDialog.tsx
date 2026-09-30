"use client";

import { useEffect } from "react";

// 정본 msConfirm(`.fmpc` 420px): 제목 16.5/800·줄높이 normal·아래 9px, 본문 13.5/500·1.65·t2(작은 줄 12.5 t3),
// 버튼 줄 위 20px·gap 8, `.fmpc-btn` 40px·r11·px18·13.5/700·자간 -0.01em.
export function SettlementDecisionDialog({
  open,
  title,
  children,
  confirmLabel,
  pendingLabel = `${confirmLabel} 중…`,
  confirmTone = "teal",
  pending = false,
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
        <h2 id="settlement-dialog-title" className="text-[16.5px] font-extrabold leading-[normal] text-t1">
          {title}
        </h2>
        <div className="pt-[9px] text-[13.5px] font-medium leading-[1.65] text-t2">
          {children}
        </div>
        <div className="flex h-[60px] items-end gap-[8px]">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="h-[40px] flex-1 rounded-[11px] border border-line bg-white px-[18px] text-[13.5px] font-bold tracking-[-0.01em] text-t2 hover:bg-bg disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`h-[40px] flex-1 rounded-[11px] border px-[18px] text-[13.5px] font-bold tracking-[-0.01em] text-white disabled:opacity-60 ${confirmTone === "danger" ? "border-red bg-red" : "border-teal bg-teal"}`}
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
