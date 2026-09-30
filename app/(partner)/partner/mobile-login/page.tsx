import Image from "next/image";
import { PartnerLoginForm } from "./PartnerLoginForm";
import { partnerLoginClasses as styles } from "./loginClasses";

export default function PartnerLoginPage() {
  return (
    <div className={styles.wrap}>
      <div className={styles.logo}>
        <Image src="/logo.png" alt="관리비서" width={168} height={120} className={styles.logoImg} />
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
