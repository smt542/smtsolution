"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

type NotifyNavigationButtonProps = {
  href: string;
  className: string;
  ariaLabel?: string;
  children: ReactNode;
};

export default function NotifyNavigationButton({
  href,
  className,
  ariaLabel,
  children,
}: NotifyNavigationButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      onClick={() => router.push(href)}
    >
      {children}
    </button>
  );
}
