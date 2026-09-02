import type { ReactNode } from "react";

import styles from "./PartnerFormFieldRow.module.css";

type PartnerFormFieldRowProps = {
  /** Row label. Pass a fragment (e.g. text + a required-marker `<b>`) for non-plain-text labels. */
  label: ReactNode;
  /** Stacks the label above the control (textarea rows) instead of the default horizontal layout. */
  column?: boolean;
  /** The control: an input/select, or a read-only value span — styled by the caller's own CSS module. */
  children: ReactNode;
};

/** Horizontal label + control row for partner A/S-style forms (`_asform.module.css` box sections). */
export function PartnerFormFieldRow({ label, column, children }: PartnerFormFieldRowProps) {
  return (
    <div className={column ? `${styles.row} ${styles.rowCol}` : styles.row}>
      <span className={styles.label}>{label}</span>
      {children}
    </div>
  );
}
