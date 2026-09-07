import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 세입자 회원 탈퇴(하드 삭제).
// 본인 세션 검증 → 세입자 신원 가드 → resident_withdraw RPC(감사 로그 + 세대 링크·카카오 신원 해제)
// → service-role deleteUser로 auth.users를 완전 삭제한다(auth.identities·cascade 자식 레코드
// [res_claims·resident_identities·move_out_requests] + 기존 세션/refresh token 정리).
// 로직감사 L5: 탈퇴 시 auth.users가 보존돼 잔여 PII가 남고 재가입 시 조용히 재사용되던 갭 해소.
export async function POST() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  // 세입자 전용: 세입자 신원이 없는 계정(직원/통합관리자)이 이 경로로 자기 계정을 삭제하지 못하게 막는다.
  // resident_withdraw가 신원 행을 지우므로, 삭제 전에 service-role로 존재 여부를 확정한다(RLS 우회).
  const admin = createAdminClient();
  const { data: identity, error: identityError } = await admin
    .from("resident_identities")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (identityError) {
    return NextResponse.json({ error: "회원 탈퇴 처리에 실패했습니다." }, { status: 500 });
  }
  if (!identity) {
    return NextResponse.json({ error: "세입자 계정이 아닙니다." }, { status: 403 });
  }

  // 1) 본인 컨텍스트(auth.uid())로 RESIDENT_WITHDRAW 감사 로그를 남긴다. 데이터가 살아있는 시점에
  //    기록해야 org/건물/호수/점유 맥락이 담긴다. (RPC의 res_claims·resident_identities 삭제는
  //    아래 deleteUser cascade와 중복이나 무해하며, 감사 기록이 이 호출의 핵심 목적이다.)
  const { error: withdrawError } = await supabase.rpc("resident_withdraw");
  if (withdrawError) {
    return NextResponse.json({ error: "회원 탈퇴 처리에 실패했습니다." }, { status: 500 });
  }

  // 2) auth.users를 완전 삭제한다 — auth.identities·cascade 자식·세션/refresh token까지 정리된다.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    // 세대 링크·신원은 1단계에서 이미 해제됐다. auth 계정 삭제만 실패한 상태로, 재요청 시 다시 시도된다.
    return NextResponse.json({ error: "계정 삭제에 실패했습니다." }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
