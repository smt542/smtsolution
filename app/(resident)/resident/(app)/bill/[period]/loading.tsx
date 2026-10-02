import { billDetailPageClasses as styles } from "@/app/(resident)/_components/billDetailPageClasses";

export default function ResidentBillDetailLoading() {
  return (
    <div className={styles.center} role="status">
      관리비 상세를 불러오고 있어요
    </div>
  );
}
