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
      {copied ? "복사되었습니다" : label}
    </button>
  );
}
