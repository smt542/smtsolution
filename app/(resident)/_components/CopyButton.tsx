"use client";

import { useEffect, useRef, useState } from "react";

interface CopyButtonProps {
  text: string;
  label: string;
  className?: string;
  disabled?: boolean;
}

export default function CopyButton({
  text,
  label,
  className,
  disabled = false,
}: CopyButtonProps) {
  const timer = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setCopied(false);
        timer.current = null;
      }, 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      className={className}
      disabled={disabled || !text}
      onClick={() => void copy()}
      aria-live="polite"
    >
      {copied ? (
        "복사되었습니다"
      ) : (
        <>
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
        </>
      )}
    </button>
  );
}
