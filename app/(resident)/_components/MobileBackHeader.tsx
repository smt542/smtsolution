import Link from "next/link";
import type { ReactNode } from "react";

export type MobileBackHeaderVariant = "list" | "detail" | "bar";

type MobileBackHeaderProps = {
  href?: string;
  label?: string;
  title: ReactNode;
  variant?: MobileBackHeaderVariant;
  back?: ReactNode;
};

export const residentBackButtonClass =
  "flex size-[38px] flex-none items-center justify-center rounded-xl text-t2 no-underline hover:bg-bg";

export const residentBackIconClass: Record<MobileBackHeaderVariant, string> = {
  list: "size-[22px]",
  detail: "size-[22px]",
  bar: "size-[21px]",
};

const headerClass: Record<MobileBackHeaderVariant, string> = {
  list: "flex flex-none items-center gap-1.5 bg-white px-3 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] leading-[normal]",
  detail:
    "flex flex-none items-center gap-2 border-b border-line2 bg-white px-3 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] leading-[normal]",
  bar: "flex flex-none items-center gap-1 border-b border-line2 bg-white px-3 pb-2 pt-[calc(env(safe-area-inset-top)+8px)] leading-[normal]",
};

const titleClass: Record<MobileBackHeaderVariant, string> = {
  list: "m-0 text-[18px] font-extrabold tracking-[-0.02em]",
  detail: "m-0 text-[17px] font-extrabold tracking-[-0.02em]",
  bar: "m-0 min-w-0 flex-1 text-[17px] font-extrabold tracking-[-0.02em]",
};

export default function MobileBackHeader({
  href,
  label,
  title,
  variant = "list",
  back,
}: MobileBackHeaderProps) {
  const backControl = back ?? (
    <Link href={href ?? "/"} aria-label={label} className={residentBackButtonClass}>
      <svg
        className={residentBackIconClass[variant]}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </Link>
  );

  return (
    <header className={headerClass[variant]}>
      {backControl}
      <h1 className={titleClass[variant]}>{title}</h1>
    </header>
  );
}
