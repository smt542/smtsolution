import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./PartnerMobileHeader.module.css";

type PartnerMobileHeaderProps = {
  /** Screen title. */
  title: ReactNode;
  /** Renders the back control as a Link navigating to this href. */
  backHref?: string;
  /** Renders the back control as a button (use when back must be intercepted, e.g. an unsaved-changes confirm). */
  onBack?: () => void;
  /**
   * Optional subtitle shown under the title. Pass `null` explicitly (rather than omitting the
   * prop) when a call site always reserves a subtitle slot but currently has nothing to show —
   * that preserves the two-line title markup even while the subtitle itself is hidden.
   */
  subtitle?: ReactNode | null;
  /** Optional trailing action slot (e.g. a Link/button styled by the page's own CSS module). */
  action?: ReactNode;
  /**
   * `default` — building/tenant style (21px title, 8px gap, 14/16/12 padding, var(--bg) hover).
   * `compact` — A/S form style (20px title, 10px gap, 6/16/14 padding, #e4e8ec hover).
   */
  variant?: "default" | "compact";
};

function BackArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function PartnerMobileHeader({ title, backHref, onBack, subtitle, action, variant = "default" }: PartnerMobileHeaderProps) {
  const compact = variant === "compact";
  const backClassName = `${styles.back} ${compact ? styles.hoverCompact : styles.hoverDefault}`;

  const backControl = onBack ? (
    <button type="button" className={backClassName} onClick={onBack} aria-label="뒤로">
      <BackArrowIcon />
    </button>
  ) : backHref ? (
    <Link href={backHref} className={backClassName} aria-label="뒤로">
      <BackArrowIcon />
    </Link>
  ) : null;

  const hasSubtitleSlot = subtitle !== undefined;

  return (
    <div className={compact ? styles.headerCompact : styles.header}>
      {backControl}
      {hasSubtitleSlot ? (
        <div className={styles.titleWrap}>
          <div className={styles.title}>{title}</div>
          {subtitle != null ? <div className={styles.sub}>{subtitle}</div> : null}
        </div>
      ) : (
        <div className={compact ? styles.titleSoloCompact : styles.titleSolo}>{title}</div>
      )}
      {action}
    </div>
  );
}
