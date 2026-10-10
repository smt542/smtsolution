import { NextResponse } from "next/server";
import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toAuthPassword } from "@/lib/auth/password";
import { isValidPassword, PASSWORD_RULE_MESSAGE } from "@/lib/auth/passwordPolicy";
import { setMustChangePassword } from "@/lib/auth/passwordState";

/** 지금 비밀번호와 같은지 — 쿠키를 건드리지 않는 별도 클라이언트로 로그인을 시도해 본다. */
async function isCurrentPassword(email: string, password: string): Promise<boolean> {
  const probe = createStatelessClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await probe.auth.signInWithPassword({ email, password: toAuthPassword(password) });
  if (error || !data.session) return false;
  await probe.auth.signOut({ scope: "local" }).catch(() => undefined);
  return true;
}

/**
 * 본인 비밀번호 변경(최초 로그인 강제 변경·내 정보 변경 공용).
 * 새 비밀번호만 받는다 — 원문은 저장하지 않고 Auth 해시로만 보관한다.
 * 성공하면 must_change_password 를 해제해 서비스 진입을 허용한다.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const newPassword = body?.newPassword;
  if (!isValidPassword(newPassword)) {
    return NextResponse.json({ error: PASSWORD_RULE_MESSAGE }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("must_change_password")
    .eq("user_id", user.id)
    .maybeSingle();

  // 임시 비밀번호를 그대로 다시 쓰는 것은 변경으로 보지 않는다.
  if (profile?.must_change_password && user.email && await isCurrentPassword(user.email, newPassword)) {
    return NextResponse.json({ error: "임시 비밀번호와 다른 비밀번호를 입력해 주세요." }, { status: 422 });
  }

  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password: toAuthPassword(newPassword),
  });
  if (error) {
    console.error("[auth/change-password] updateUserById failed", error.message);
    return NextResponse.json({ error: "비밀번호 변경에 실패했습니다." }, { status: 500 });
  }

  if (!(await setMustChangePassword(admin, user.id, false, "[auth/change-password]"))) {
    return NextResponse.json({ error: "비밀번호는 변경되었지만 상태 저장에 실패했습니다. 다시 시도해 주세요." }, { status: 500 });
  }

  const { data: member } = await admin
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const { error: auditError } = await admin.from("audit_log").insert({
    org_id: member?.org_id ?? null,
    actor_id: user.id,
    action: "ACCOUNT_PASSWORD_CHANGE",
    table_name: "profiles",
    row_pk: user.id,
  });
  if (auditError) console.error("[auth/change-password] audit_log insert failed", auditError.message);

  return NextResponse.json({ ok: true });
}
