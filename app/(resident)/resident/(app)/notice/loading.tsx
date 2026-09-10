import styles from "./notice.module.css";

export default function ResidentNoticeLoading() {
  return (
    <div className={styles.center} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      공지사항을 불러오고 있어요.
    </div>
  );
}
