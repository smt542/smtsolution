import styles from "./detail.module.css";

export default function ResidentBillDetailLoading() {
  return (
    <div className={styles.center} role="status">
      관리비 상세를 불러오고 있어요
    </div>
  );
}
