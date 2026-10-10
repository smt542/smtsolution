import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidPassword, PASSWORD_RULE_MESSAGE } from "@/lib/auth/passwordPolicy";
import { setMustChangePassword } from "@/lib/auth/passwordState";
import { toAuthPassword } from "@/lib/auth/password";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  // 본사 계정 관리는 마스터·운영만 가능하다(0227 current_user_can_manage_hq_accounts).
  const { data: canManage } = await supabase.rpc("current_user_can_manage_hq_accounts");
  if (canManage !== true) {
    return NextResponse.json({ error: "통합관리자 권한이 필요합니다." }, { status: 403 });
  }

  const { password } = await req.json().catch(() => ({}));
  if (!isValidPassword(password)) {
    return NextResponse.json({ error: PASSWORD_RULE_MESSAGE }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data: targetMembers } = await admin
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1);
  const targetOrgId = targetMembers?.[0]?.org_id ?? null;
  if (!targetMembers?.length) {
    return NextResponse.json({ error: "대상 계정을 찾을 수 없습니다." }, { status: 404 });
  }

  // 기존 4자리 PIN 계정과 같은 변환 규칙을 쓴다(로그인 검증도 toAuthPassword).
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: toAuthPassword(String(password)),
  });
  if (error) {
    return NextResponse.json({ error: "비밀번호 변경에 실패했습니다." }, { status: 500 });
  }
  // 비밀번호 변경 후 대상 계정의 기존 세션을 폐기한다(리셋 후 구세션 잔존 방지). 폐기 실패가 변경을 막지 않는다.
  const { error: revokeError } = await admin.rpc("revoke_user_sessions", { p_user_id: userId });
  if (revokeError) console.error("[platform accounts] revoke_user_sessions failed", revokeError.message);
  // 관리자가 재설정한 비밀번호는 임시 비밀번호 — 다음 로그인 때 본인 변경을 강제한다(본인 재설정은 제외).
  if (userId !== userData.user.id) await setMustChangePassword(admin, userId, true, "[platform accounts]");
  // 비밀번호 변경 감사 로그. 기록 실패는 변경을 막지 않는다.
  const { error: auditError } = await admin.from("audit_log").insert({
    org_id: targetOrgId,
    actor_id: userData.user.id,
    action: "ACCOUNT_PASSWORD_RESET",
    table_name: "profiles",
    row_pk: userId,
  });
  if (auditError) console.error("[platform accounts] audit_log insert failed", auditError.message);
  return NextResponse.json({ ok: true }, { status: 200 });
}
