import Link from "next/link";
import type { ReactNode } from "react";

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
    <svg className="size-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function PartnerMobileHeader({ title, backHref, onBack, subtitle, action, variant = "default" }: PartnerMobileHeaderProps) {
  const compact = variant === "compact";
  const backClassName = `flex size-[38px] flex-none items-center justify-center rounded-xl text-t2 ${compact ? "hover:bg-[#E4E8EC]" : "hover:bg-bg"}`;

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
    <div className={compact ? "flex items-center gap-2.5 px-4 pb-3.5 pt-1.5" : "flex items-center gap-2 px-4 pb-3 pt-3.5"}>
      {backControl}
      {hasSubtitleSlot ? (
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[21px] font-extrabold tracking-[-0.02em]">{title}</div>
          {subtitle != null ? <div className="mt-0.5 text-[13px] font-semibold text-t3">{subtitle}</div> : null}
        </div>
      ) : (
        <div className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap font-extrabold tracking-[-0.02em] ${compact ? "text-xl" : "text-[21px]"}`}>{title}</div>
      )}
      {action}
    </div>
  );
}
