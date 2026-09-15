import styles from "./mobile-ms-new.module.css";
import { Spinner } from "@/components/common";

export default function PartnerMsNewLoading() {
  return (
    <div className={styles.root}>
      <Spinner label="이사정산 화면 불러오는 중" showLabel className="min-h-[240px]" />
    </div>
  );
}
