import Link from "next/link";
import type { ReactNode } from "react";

import ResidentScreenFrame from "@/app/(resident)/_components/ResidentScreenFrame";

type PublicTokenPageShellProps = {
  brand: ReactNode;
  subtitle: ReactNode;
  ctaLabel: ReactNode;
  showCta?: boolean;
  children: ReactNode;
};

export default function PublicTokenPageShell({
  brand,
  subtitle,
  ctaLabel,
  showCta = true,
  children,
}: PublicTokenPageShellProps) {
  return (
    <ResidentScreenFrame
      variant="public"
      header={
        <>
          <span className="text-lg font-black tracking-[-0.04em] text-blue-d">{brand}</span>
          <span>{subtitle}</span>
        </>
      }
    >
      {children}
      {showCta ? (
        <Link className="mt-3.5 flex min-h-[50px] items-center justify-center rounded-btn bg-blue text-sm font-extrabold text-white no-underline" href="/resident/login">
          {ctaLabel}
        </Link>
      ) : null}
    </ResidentScreenFrame>
  );
}
