import type { ReactNode } from "react";

import { PartnerNav } from "./PartnerNav";
import styles from "./_tabs.module.css";

export default function PartnerTabsLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.frame}>
      <div className={styles.body}>{children}</div>
      <PartnerNav />
    </div>
  );
}
