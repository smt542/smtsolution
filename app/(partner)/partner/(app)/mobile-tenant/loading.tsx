import { PartnerMobileHeader } from "../../../_components/PartnerMobileHeader";
import styles from "./mobile-tenant.module.css";

export default function PartnerTenantLoading() {
  return (
    <div className={styles.root}>
      <PartnerMobileHeader
        title="입주자"
        backHref="/partner/mobile-inquiry"
        subtitle={null}
      />
      <div className={styles.none} role="status" aria-label="입주자 화면 불러오는 중">
        불러오는 중…
      </div>
    </div>
  );
}
