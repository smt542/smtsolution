"use client";
import { useEffect, useId } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  className = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full rounded-2xl bg-surface p-6 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-extrabold">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
