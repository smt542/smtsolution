"use client";

import { useEffect, useId } from "react";

export function ComplaintDialog({
  open,
  onClose,
  title,
  children,
  size = "large",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "medium" | "large";
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
        className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-surface p-6 shadow-pop ${
          size === "large" ? "max-w-5xl" : "max-w-2xl"
        }`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-xl font-extrabold text-t1">
            {title}
          </h2>
          <button
            type="button"
            aria-label="닫기"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-t3 hover:bg-bg hover:text-t1"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </section>
    </div>
  );
}
