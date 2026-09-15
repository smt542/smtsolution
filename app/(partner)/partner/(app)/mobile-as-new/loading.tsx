import { PartnerMobileHeader } from "../../../_components/PartnerMobileHeader";
import styles from "../_asform.module.css";

export default function PartnerAsNewLoading() {
  return (
    <div className={styles.root}>
      <PartnerMobileHeader
        title="신규 접수"
        backHref="/partner/mobile-home"
        variant="compact"
      />
      <div className={styles.none} role="status" aria-label="신규 접수 화면 불러오는 중">
        불러오는 중…
      </div>
    </div>
  );
}
