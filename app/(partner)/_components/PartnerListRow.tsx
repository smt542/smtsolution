import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./PartnerListRow.module.css";

type PartnerListRowProps = {
  /** Navigation target. */
  href: string;
  /** Trailing right-chevron indicating this row navigates onward. */
  chevron?: boolean;
  /** Row content — styled by the caller's own CSS module. */
  children: ReactNode;
};

function ChevronRightIcon() {
  return (
    <svg className={styles.chev} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

/** Divider list row: a full-row Link wrapping page-owned content, with an optional trailing chevron. */
export function PartnerListRow({ href, chevron, children }: PartnerListRowProps) {
  return (
    <Link href={href} className={styles.row}>
      {children}
      {chevron ? <ChevronRightIcon /> : null}
    </Link>
  );
}
