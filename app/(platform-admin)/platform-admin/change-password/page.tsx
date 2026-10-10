import { PasswordChangeScreen } from "@/components/auth/PasswordChangeScreen";
import { requirePendingPasswordChange } from "@/lib/auth/requirePasswordChanged";

// 임시 비밀번호 강제 변경 화면. (app) 게이트 밖에 두어 리다이렉트 루프가 없게 한다.
export default async function PlatformChangePasswordPage() {
  await requirePendingPasswordChange("/platform-admin/login", "/platform-admin");
  return <PasswordChangeScreen homePath="/platform-admin" loginPath="/platform-admin/login" />;
}
