"use client";

import {
  showResidentToast,
  type ResidentToastOffset,
} from "./residentToast";

interface CopyButtonProps {
  text: string;
  label: string;
  toastMessage: string;
  toastOffset?: ResidentToastOffset;
  className?: string;
  disabled?: boolean;
}

export default function CopyButton({
  text,
  label,
  toastMessage,
  toastOffset = "page",
  className,
  disabled = false,
}: CopyButtonProps) {
  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopy(text);
      }
      showResidentToast(toastMessage, toastOffset);
    } catch {
      try {
        fallbackCopy(text);
        showResidentToast(toastMessage, toastOffset);
      } catch {
        showResidentToast("복사하지 못했어요", toastOffset);
      }
    }
  };

  return (
    <button
      type="button"
      className={className}
      disabled={disabled || !text}
      onClick={() => void copy()}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="9" y="9" width="11" height="11" rx="2.5" />
        <path d="M15 5.5A2.5 2.5 0 0012.5 3h-7A2.5 2.5 0 003 5.5v7A2.5 2.5 0 005.5 15" />
      </svg>
      {label}
    </button>
  );
}

function fallbackCopy(value: string): void {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    if (!document.execCommand("copy")) throw new Error("copy failed");
  } finally {
    textarea.remove();
  }
}
