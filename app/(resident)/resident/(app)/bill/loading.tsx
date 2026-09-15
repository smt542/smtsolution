import styles from "./bill.module.css";

export default function ResidentBillLoading() {
  return (
    <div className={styles.center} role="status" aria-label="관리비 내역 불러오는 중">
      <span className={styles.spinner} aria-hidden="true" />
      <span>관리비 내역을 불러오고 있어요</span>
    </div>
  );
}
