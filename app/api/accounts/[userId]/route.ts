import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidPasswordFor, passwordRuleMessage } from "@/lib/auth/passwordPolicy";
import { passwordRuleForUser, setMustChangePassword } from "@/lib/auth/passwordState";
import { toAuthPassword } from "@/lib/auth/password";

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data: ctxRows } = await supabase.rpc("get_my_context");
  const ctx = Array.isArray(ctxRows) ? ctxRows[0] : ctxRows;
  const isMaster = ctx?.role === "org_owner" || ctx?.role === "platform_admin";
  const perms: string[] = Array.isArray(ctx?.permissions) ? ctx.permissions : [];
  if (!ctx || (!isMaster && !perms.includes("accounts")))
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  // persona 게이트: field/support 파트너·세입자 세션 배제(기존 권한검사에 더한 방어).
  const { data: isManagerStaff } = await supabase.rpc("current_user_is_manager_staff");
  if (isManagerStaff !== true) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  // 대상이 현재 컨텍스트의 org 구성원인지 확인한다.
  const { data: targetMember } = await supabase
    .from("org_members")
    .select("user_id, role")
    .eq("org_id", ctx.org_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!targetMember) return NextResponse.json({ error: "대상 계정을 찾을 수 없습니다." }, { status: 404 });

  // 대상이 마스터(org_owner)이면 같은 org의 마스터만 비밀번호를 재설정할 수 있다.
  if (targetMember.role === "org_owner" && ctx.role !== "org_owner")
    return NextResponse.json({ error: "마스터 계정은 마스터만 변경할 수 있습니다." }, { status: 403 });

  const { password } = await req.json().catch(() => ({}));
  const admin = createAdminClient();
  // 사무실 관리자(manager_staff) 계정은 숫자 4자리 비밀번호.
  const passwordRule = await passwordRuleForUser(admin, userId);
  if (!isValidPasswordFor(passwordRule, password))
    return NextResponse.json({ error: passwordRuleMessage(passwordRule) }, { status: 422 });

  const { error } = await admin.auth.admin.updateUserById(userId, { password: toAuthPassword(password) });
  if (error) {
    console.error("[accounts] updateUserById failed", error.message);
    return NextResponse.json({ error: "비밀번호 변경에 실패했습니다." }, { status: 500 });
  }

  // 비밀번호 변경 후 대상 계정의 기존 세션을 폐기한다(리셋 후 구세션 잔존 방지). 폐기 실패가 변경을 막지 않는다.
  const { error: revokeError } = await admin.rpc("revoke_user_sessions", { p_user_id: userId });
  if (revokeError) console.error("[accounts] revoke_user_sessions failed", revokeError.message);
  // 관리자가 재설정한 비밀번호는 임시 비밀번호 — 다음 로그인 때 본인 변경을 강제한다(본인 재설정은 제외).
  if (userId !== userData.user.id) await setMustChangePassword(admin, userId, true, "[accounts]");

  return NextResponse.json({ ok: true }, { status: 200 });
}
