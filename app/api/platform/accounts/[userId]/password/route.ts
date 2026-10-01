import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { storeAccountLoginPin } from "@/lib/auth/loginPin";
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

  const { data: isPa } = await supabase.rpc("current_user_is_platform_admin");
  if (!isPa) {
    return NextResponse.json({ error: "통합관리자 권한이 필요합니다." }, { status: 403 });
  }

  const { password } = await req.json().catch(() => ({}));
  if (!password || String(password).length < 4) {
    return NextResponse.json({ error: "비밀번호는 4자 이상 입력해 주세요." }, { status: 422 });
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from("org_members")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (!count) {
    return NextResponse.json({ error: "대상 계정을 찾을 수 없습니다." }, { status: 404 });
  }

  // 4자리 PIN은 Auth 최소 길이(6) 때문에 변환해서 저장한다 — 로그인 검증도 같은 변환을 쓴다.
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: toAuthPassword(String(password)),
  });
  if (error) {
    return NextResponse.json({ error: "비밀번호 변경에 실패했습니다." }, { status: 500 });
  }
  // 비밀번호 변경 후 대상 계정의 기존 세션을 폐기한다(리셋 후 구세션 잔존 방지). 폐기 실패가 변경을 막지 않는다.
  const { error: revokeError } = await admin.rpc("revoke_user_sessions", { p_user_id: userId });
  if (revokeError) console.error("[platform accounts] revoke_user_sessions failed", revokeError.message);
  // 실제로 입력한 새 PIN을 저장한다. 저장 실패는 비밀번호 변경을 막지 않는다.
  await storeAccountLoginPin(admin, userId, String(password), "[platform accounts]");
  return NextResponse.json({ ok: true }, { status: 200 });
}
