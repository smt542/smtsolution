import Link from "next/link";
import type { ReactNode } from "react";

import ResidentScreenFrame from "@/app/(resident)/_components/ResidentScreenFrame";

import styles from "./PublicTokenPageShell.module.css";

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
          <span className={styles.brand}>{brand}</span>
          <span>{subtitle}</span>
        </>
      }
    >
      {children}
      {showCta ? (
        <Link className={styles.cta} href="/resident/login">
          {ctaLabel}
        </Link>
      ) : null}
    </ResidentScreenFrame>
  );
}
