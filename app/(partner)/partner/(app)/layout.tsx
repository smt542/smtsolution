import type { ReactNode } from "react";
import { requirePersona } from "@/lib/auth/requirePersona";
import { requirePasswordChanged } from "@/lib/auth/requirePasswordChanged";
import { EntryPersonaWatcher } from "@/components/EntryPersonaWatcher";

// 파트너 앱(로그인 제외) 공통 가드: 현장(field/support) capability 보유자만 통과.
// persona 술어 seam으로 편입(겸직 지원). 무세션→/partner/mobile-login, persona 불일치→중립 '/'.
export default async function PartnerAppLayout({ children }: { children: ReactNode }) {
  await requirePersona("field_partner", "/partner/mobile-login");
  // 임시 비밀번호 상태면 변경을 마칠 때까지 현장 화면에 들어가지 못한다.
  await requirePasswordChanged("/partner/change-password");
  return <><EntryPersonaWatcher persona="field_partner" />{children}</>;
}
