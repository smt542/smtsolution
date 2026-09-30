import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const { count: membershipCount } = await supabase
    .from("org_members")
    .select("user_id", { count: "exact", head: true })
    .eq("org_id", ctx.org_id)
    .eq("user_id", userId);
  if (!membershipCount) return NextResponse.json({ error: "대상 계정을 찾을 수 없습니다." }, { status: 404 });

  const { password } = await req.json().catch(() => ({}));
  if (typeof password !== "string" || !/^\d{4}$/.test(password))
    return NextResponse.json({ error: "비밀번호는 숫자 4자리를 입력해 주세요." }, { status: 422 });

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password: toAuthPassword(password) });
  if (error) {
    console.error("[accounts] updateUserById failed", error.message);
    return NextResponse.json({ error: "비밀번호 변경에 실패했습니다." }, { status: 500 });
  }

  // 비밀번호 변경 후 대상 계정의 기존 세션을 폐기한다(리셋 후 구세션 잔존 방지). 폐기 실패가 변경을 막지 않는다.
  const { error: revokeError } = await admin.rpc("revoke_user_sessions", { p_user_id: userId });
  if (revokeError) console.error("[accounts] revoke_user_sessions failed", revokeError.message);
  // 파트너 프로필 비밀번호 보기(0212)에 저장해 둔 옛 비밀번호를 지운다 — 다시 로그인하면 새 값이 저장된다.
  const { error: pinError } = await admin.from("partner_login_pins").delete().eq("user_id", userId);
  if (pinError) console.error("[accounts] partner_login_pins clear failed", pinError.message);

  return NextResponse.json({ ok: true }, { status: 200 });
}
