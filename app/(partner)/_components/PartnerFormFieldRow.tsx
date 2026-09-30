import type { ReactNode } from "react";

type PartnerFormFieldRowProps = {
  /** Row label. Pass a fragment (e.g. text + a required-marker `<b>`) for non-plain-text labels. */
  label: ReactNode;
  /** Stacks the label above the control (textarea rows) instead of the default horizontal layout. */
  column?: boolean;
  /** The control: an input/select, or a read-only value span — styled by the caller's own CSS module. */
  children: ReactNode;
};

/** Horizontal label + control row for partner A/S forms (정본 `.row`: padding 13px 0, 라벨 104px). */
export function PartnerFormFieldRow({ label, column, children }: PartnerFormFieldRowProps) {
  return (
    <div className={column ? "flex flex-col items-stretch gap-2 border-b border-line2 py-[13px] last:border-b-0" : "flex items-center gap-3 border-b border-line2 py-[13px] last:border-b-0"}>
      <span className={column ? "w-auto text-[13.5px] font-semibold text-t3" : "w-[104px] flex-none text-[13.5px] font-semibold text-t3"}>{label}</span>
      {children}
    </div>
  );
}
