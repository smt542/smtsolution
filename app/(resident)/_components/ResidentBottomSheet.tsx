"use client";

import { useEffect, type ReactNode } from "react";

type ResidentBottomSheetProps = {
  id?: string;
  variant: "compact" | "stepped" | "moveOut";
  open: boolean;
  onDismiss: () => void;
  children: ReactNode;
};

const panelClassByVariant = {
  compact: "w-full max-w-[440px] rounded-t-[22px] bg-white px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-2.5",
  stepped: "flex h-[min(640px,calc(100dvh-40px))] max-h-[calc(100dvh-40px)] w-full max-w-[440px] flex-col rounded-t-[22px] bg-white px-6 pb-[calc(env(safe-area-inset-bottom)+22px)] pt-2.5",
  // 원본 resident-home `.ms-b` — 내용 높이, 넘치면 시트째 스크롤, 열릴 때 `up` .3s
  moveOut: "max-h-[calc(100dvh-32px)] w-full max-w-[440px] animate-[resident-sheet-up_0.3s_cubic-bezier(.22,.61,.36,1)_both] overflow-auto overscroll-contain rounded-t-[22px] bg-white px-[22px] pb-[calc(env(safe-area-inset-bottom)+18px)] pt-2",
} as const;

const grabClassByVariant = {
  compact: "mx-auto mb-4 h-1 w-9 rounded-sm bg-line",
  stepped: "mx-auto mb-4 h-1 w-9 flex-none rounded-sm bg-line",
  moveOut: "mx-auto mb-4 h-1 w-[38px] rounded-full bg-line",
} as const;

export default function ResidentBottomSheet({
  id,
  variant,
  open,
  onDismiss,
  children,
}: ResidentBottomSheetProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onDismiss]);

  return (
    <div
      id={id}
      className={`fixed inset-0 ${variant === "moveOut" ? "z-[115]" : "z-[90]"} items-end justify-center overflow-hidden bg-scrim ${open ? "flex" : "hidden"}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onDismiss();
        }
      }}
    >
      <div className={panelClassByVariant[variant]}>
        <div className={grabClassByVariant[variant]} />
        {children}
      </div>
    </div>
  );
}
