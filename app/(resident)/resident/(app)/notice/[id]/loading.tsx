import MobileBackHeader from "@/app/(resident)/_components/MobileBackHeader";

import { noticeDetailClasses as styles } from "./detailClasses";

export default function ResidentNoticeDetailLoading() {
  return (
    <div className={styles.page}>
      <MobileBackHeader
        href="/resident/notice"
        label="공지 목록으로 돌아가기"
        title="공지사항"
        divider
      />
      <div className={styles.center} role="status">
        공지를 불러오고 있어요.
      </div>
    </div>
  );
}
