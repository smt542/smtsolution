import { noticeClasses as styles } from "./noticeClasses";

export default function ResidentNoticeLoading() {
  return (
    <div className={styles.center} role="status" aria-label="공지사항 불러오는 중">
      <span className={styles.spinner} aria-hidden="true" />
      공지사항을 불러오고 있어요.
    </div>
  );
}
