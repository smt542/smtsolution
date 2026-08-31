"use client";

import { useEffect, useId } from "react";

const SIZE_CLASS = {
  medium: "max-w-2xl",
  large: "max-w-5xl",
  wide: "max-w-[1080px]",
} as const;

export function ComplaintDialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "large",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof SIZE_CLASS;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex max-h-[92vh] w-full flex-col rounded-2xl bg-surface p-6 shadow-pop ${SIZE_CLASS[size]}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-extrabold text-t1">
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-sm text-t3">{subtitle}</p>}
          </div>
          <button
            type="button"
            aria-label="닫기"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-t3 hover:bg-bg hover:text-t1"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="mt-5 min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="mt-5 shrink-0 border-t border-line pt-4">{footer}</div>
        )}
      </section>
    </div>
  );
}
