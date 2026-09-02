import type { AriaRole, ReactNode } from "react";

type InlineAlertTone = "danger" | "warning" | "dangerStrong";

const TONE_CLASSNAMES: Record<InlineAlertTone, string> = {
  danger: "rounded-xl bg-red-t px-3 py-2 text-xs font-semibold text-red",
  warning: "rounded-xl bg-amber-t px-3 py-2 text-xs font-semibold text-amber",
  dangerStrong: "rounded-xl bg-red-t px-3 py-2 text-sm font-semibold text-red",
};

/**
 * Rounded inline message block. `tone` maps 1:1 to a call site's exact
 * pre-existing classes — it is not a generic design-system variant, so add a
 * new tone only when reproducing another site's literal markup exactly.
 */
export function InlineAlert({
  tone,
  role,
  children,
}: {
  tone: InlineAlertTone;
  role?: AriaRole;
  children: ReactNode;
}) {
  return (
    <p role={role} className={TONE_CLASSNAMES[tone]}>
      {children}
    </p>
  );
}
