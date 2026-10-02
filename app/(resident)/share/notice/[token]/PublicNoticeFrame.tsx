import type { ReactNode } from "react";

import ResidentGuestHeader from "@/app/(resident)/_components/ResidentGuestHeader";
import { noticeDetailClasses as styles } from "@/app/(resident)/_components/noticeDetailClasses";

/** 정본 resident-notice-detail `.screen.guest` — 로고 상단바 아래에 본문·상태 안내. */
export default function PublicNoticeFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <ResidentGuestHeader variant="detail" />
      {children}
    </div>
  );
}
