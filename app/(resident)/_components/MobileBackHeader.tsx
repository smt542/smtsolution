import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./MobileBackHeader.module.css";

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
      className={
        divider ? `${styles.header} ${styles.divider}` : styles.header
      }
    >
      <Link href={href} aria-label={label}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Link>
      <h1>{title}</h1>
      <span aria-hidden="true" />
    </header>
  );
}
