"use client";

import { PartnerMobileHeader } from "../../../_components/PartnerMobileHeader";
import styles from "../_asform.module.css";

export default function PartnerAsNewLoading() {
  return (
    <div className={styles.root}>
      <PartnerMobileHeader
        title="신규 접수"
        onBack={() => undefined}
        variant="compact"
      />
      <div className={styles.none}>불러오는 중…</div>
    </div>
  );
}
