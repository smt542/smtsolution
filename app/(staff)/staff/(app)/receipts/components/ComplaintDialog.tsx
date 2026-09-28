"use client";

import { useEffect, useId } from "react";
import { CloseIcon } from "@/components/icons";

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
  look = "legacy",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof SIZE_CLASS;
  look?: "legacy" | "canon" | "canon-wide";
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

  if (look === "canon-wide") {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
        onMouseDown={onClose}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="flex max-h-[90vh] w-[min(1080px,96%)] flex-col overflow-auto rounded-[20px] bg-surface px-[26px] pb-[24px] pt-[28px] text-left leading-[normal] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.45)]"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-start gap-[8px]">
            <div className="min-w-0">
              <h2 id={titleId} className="mb-[4px] text-[16.5px] font-extrabold text-t1">
                {title}
              </h2>
            </div>
            <div className="flex-1" />
            <button
              type="button"
              aria-label="닫기"
              className="flex size-[26px] shrink-0 items-center justify-center rounded-[8px] border border-line bg-surface text-t3 transition-[border-color,background] duration-[120ms] hover:border-[#C9D0D8] hover:bg-[#F7F9FA] hover:text-t2"
              onClick={onClose}
            >
              <svg
                className="size-[14px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12" />
                <path d="M18 6L6 18" />
              </svg>
            </button>
          </div>
          {subtitle && (
            <p className="mb-[16px] shrink-0 text-[12.5px] font-medium text-t3">{subtitle}</p>
          )}
          {children}
          {footer && (
            <div className="mt-[16px] flex shrink-0 items-center gap-[10px]">{footer}</div>
          )}
        </section>
      </div>
    );
  }

  if (look === "canon") {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
        onMouseDown={onClose}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="flex max-h-[88vh] w-[min(680px,94%)] flex-col overflow-y-auto rounded-[20px] bg-surface px-[26px] pb-[24px] pt-[28px] text-left leading-[normal] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.45)]"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-start gap-[8px]">
            <div className="min-w-0">
              <h2 id={titleId} className="text-[16.5px] font-extrabold text-t1">
                {title}
              </h2>
              {subtitle && <p className="mt-[4px] text-[12.5px] font-medium text-t3">{subtitle}</p>}
            </div>
            <div className="flex-1" />
            <button
              type="button"
              aria-label="닫기"
              className="flex size-[26px] shrink-0 items-center justify-center rounded-[8px] border border-line bg-surface text-t3 transition-[border-color,background] duration-[120ms] hover:border-[#C9D0D8] hover:bg-[#F7F9FA] hover:text-t2"
              onClick={onClose}
            >
              <CloseIcon className="size-[14px]" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-[12px]">{children}</div>
          {footer && <div className="mt-[20px] shrink-0">{footer}</div>}
        </section>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
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
