import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 현장(field) 계정 유형. 이 유형만 파트너 모바일 앱에 로그인할 수 있다.
const FIELD_TYPES = ["field_staff", "support_staff"];

const INVALID = "아이디 또는 비밀번호가 올바르지 않습니다.";

// 파트너 로그인은 회사코드 없이 아이디+비밀번호만 받는다(명세). username은 org 내에서만
// 유일하므로, 서비스롤로 동일 아이디의 현장 계정 후보를 찾아 실제 이메일로 로그인한다.
// 후보가 여럿(다른 org에 같은 아이디)이면 비밀번호가 맞는 계정에서 세션이 성립한다.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { username?: unknown; password?: unknown }
    | null;
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password) {
    return NextResponse.json({ error: "아이디와 비밀번호를 입력해 주세요." }, { status: 422 });
  }

  const admin = createAdminClient();

  // 1) 아이디 → 활성 프로필
  const { data: profiles, error: profErr } = await admin
    .from("profiles")
    .select("user_id, is_active")
    .eq("username", username);
  if (profErr) {
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
  const activeIds = (profiles ?? []).filter((p) => p.is_active).map((p) => p.user_id as string);
  if (activeIds.length === 0) {
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  // 2) 현장 계정 후보로 좁히기
  const { data: members, error: memberErr } = await admin
    .from("org_members")
    .select("user_id, staff_type")
    .in("user_id", activeIds)
    .in("staff_type", FIELD_TYPES);
  if (memberErr) {
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
  const fieldIds = [...new Set((members ?? []).map((m) => m.user_id as string))];
  if (fieldIds.length === 0) {
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  // 3) 후보 이메일로 세션 수립 시도(비밀번호 검증이 후보를 자연스럽게 판별)
  const sessionClient = await createClient();
  for (const uid of fieldIds) {
    const { data: got, error: getErr } = await admin.auth.admin.getUserById(uid);
    const email = got?.user?.email;
    if (getErr || !email) continue;
    const { data: sess, error: signErr } = await sessionClient.auth.signInWithPassword({
      email,
      password,
    });
    if (!signErr && sess.session) {
      return NextResponse.json({ userId: uid });
    }
  }

  return NextResponse.json({ error: INVALID }, { status: 401 });
}
