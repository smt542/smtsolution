import type { ReactNode } from "react";

type PartnerBottomActionBarProps = {
  /** The action button(s) (or a status note in read-only states) — styled by the caller's own CSS module. */
  children: ReactNode;
};

/** Fixed, bordered bottom footer bar for mobile partner screens. Holds one or two page-authored actions. */
export function PartnerBottomActionBar({ children }: PartnerBottomActionBarProps) {
  return <div className="flex flex-none gap-[9px] border-t border-line bg-white px-5 pb-[22px] pt-3">{children}</div>;
}
