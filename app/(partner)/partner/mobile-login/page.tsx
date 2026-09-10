import { PartnerLoginForm } from "./PartnerLoginForm";
import styles from "./mobile-login.module.css";

export default function PartnerLoginPage() {
  return (
    <div className={styles.wrap}>
      <div className={styles.logo}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="관리비서" />
      </div>

      <PartnerLoginForm>
        <div className={styles.help}>
          계정 문의는 관리사무소에 요청해 주세요.
          <br />
          문의 : 042-632-8770
        </div>
      </PartnerLoginForm>
    </div>
  );
}
