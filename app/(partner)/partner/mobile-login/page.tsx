import Image from "next/image";
import type { Viewport } from "next";
import { PartnerLoginForm } from "./PartnerLoginForm";
import { partnerLoginClasses as styles } from "./loginClasses";
import { ORG_SUSPENDED_ERROR, ORG_SUSPENDED_MESSAGE } from "@/lib/auth/orgSuspended";

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default async function PartnerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  // 앱 게이트가 정지 테넌트 세션을 끊고 보낸 경우 안내 문구를 띄운다.
  const initialError = error === ORG_SUSPENDED_ERROR ? ORG_SUSPENDED_MESSAGE : undefined;

  return (
    <div data-partner-login className={styles.wrap}>
      <div className={styles.logo}>
        <Image src="/logo.png" alt="관리비서" width={168} height={120} className={styles.logoImg} />
      </div>

      <PartnerLoginForm initialError={initialError}>
        <div className={styles.help}>
          계정 문의는 관리사무소에 요청해 주세요.
          <br />
          문의 : 042-632-8770
        </div>
      </PartnerLoginForm>
    </div>
  );
}
