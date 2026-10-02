import type { ReactNode } from "react";

import { billDetailPageClasses as styles } from "@/app/(resident)/_components/billDetailPageClasses";
import ResidentGuestHeader from "@/app/(resident)/_components/ResidentGuestHeader";

/** 정본 resident-bill-detail `.screen.guest` — 로고 상단바 아래에 고지서·상태 안내. */
export default function PublicBillFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <ResidentGuestHeader variant="bar" />
      {children}
    </div>
  );
}
