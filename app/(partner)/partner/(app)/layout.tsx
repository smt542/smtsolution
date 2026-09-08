import type { ReactNode } from "react";
import { requirePersona } from "@/lib/auth/requirePersona";

// 파트너 앱(로그인 제외) 공통 가드: 현장(field/support) capability 보유자만 통과.
// persona 술어 seam으로 편입(겸직 지원). 무세션→/partner/mobile-login, persona 불일치→중립 '/'.
export default async function PartnerAppLayout({ children }: { children: ReactNode }) {
  await requirePersona("field_partner", "/partner/mobile-login");
  return <>{children}</>;
}
