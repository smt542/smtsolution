"use client";
import { useId } from "react";
import { useDialogLayer } from "./dialogStack";

export function Modal({
  open,
  onClose,
  title,
  children,
  className = "max-w-md",
  overlayClassName = "",
  bodyClassName = "mt-4",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  overlayClassName?: string;
  bodyClassName?: string;
}) {
  const titleId = useId();
  // ESC는 최상단 대화상자만 처리하고, body 스크롤 잠금은 열린 대화상자 수로 관리한다.
  useDialogLayer(open, onClose);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-scrim ${overlayClassName}`}
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
        <div className={bodyClassName}>{children}</div>
      </div>
    </div>
  );
}
