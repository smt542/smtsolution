import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const FIELD_TYPES = ["field_staff", "support_staff"];

// 파트너 앱(로그인 제외) 공통 가드: 현장(field) 계정만 통과.
// 미인증은 proxy가 이미 막지만 방어적으로 재확인하고, 비-field 인증 계정은
// /staff로 되돌린다(로그인 화면으로 보내면 proxy와 리다이렉트 루프가 생김).
export default async function PartnerAppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/partner/mobile-login");

  const { data: ctxRows } = await supabase.rpc("get_my_context");
  const ctx = Array.isArray(ctxRows) ? ctxRows[0] : ctxRows;
  const isField = Boolean(ctx) && FIELD_TYPES.includes(ctx.staff_type);
  if (!isField) redirect("/staff");

  return <>{children}</>;
}
