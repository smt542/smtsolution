import Link from "next/link";
import type { ReactNode } from "react";

type MobileBackHeaderProps = {
  href: string;
  label: string;
  title: ReactNode;
  divider?: boolean;
};

export default function MobileBackHeader({
  href,
  label,
  title,
  divider = false,
}: MobileBackHeaderProps) {
  return (
    <header
      className={`grid min-h-[58px] flex-none grid-cols-[42px_1fr_42px] items-center bg-white px-4 pt-[env(safe-area-inset-top)] ${divider ? "border-b border-line2" : ""}`}
    >
      <Link href={href} className="flex size-[42px] items-center justify-center rounded-xl text-t1 hover:bg-blue-t2 hover:text-blue-d" aria-label={label}>
        <svg className="size-[22px] fill-none stroke-current stroke-2" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Link>
      <h1 className="m-0 text-center text-lg">{title}</h1>
      <span aria-hidden="true" />
    </header>
  );
}
