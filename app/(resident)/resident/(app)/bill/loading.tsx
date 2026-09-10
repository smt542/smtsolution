import styles from "./bill.module.css";

export default function ResidentBillLoading() {
  return (
    <div className={styles.center} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <span>관리비 내역을 불러오고 있어요</span>
    </div>
  );
}
