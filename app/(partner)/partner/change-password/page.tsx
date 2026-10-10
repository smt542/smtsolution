import { PasswordChangeScreen } from "@/components/auth/PasswordChangeScreen";
import { requirePendingPasswordChange } from "@/lib/auth/requirePasswordChanged";

// 임시 비밀번호 강제 변경 화면. (app) 게이트 밖에 두어 리다이렉트 루프가 없게 한다.
export default async function PartnerChangePasswordPage() {
  await requirePendingPasswordChange("/partner/mobile-login", "/partner/mobile-home");
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <PasswordChangeScreen homePath="/partner/mobile-home" loginPath="/partner/mobile-login" />
    </div>
  );
}
