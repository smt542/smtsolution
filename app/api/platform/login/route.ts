import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const INVALID = "아이디 또는 비밀번호가 올바르지 않습니다.";

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
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("user_id, is_active")
    .eq("username", username);

  if (profileError) {
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다." }, { status: 500 });
  }

  const activeUserIds = (profiles ?? [])
    .filter((profile) => profile.is_active)
    .map((profile) => profile.user_id as string);

  if (activeUserIds.length === 0) {
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  const { data: memberships, error: membershipError } = await admin
    .from("org_members")
    .select("user_id")
    .in("user_id", activeUserIds)
    .eq("role", "platform_admin");

  if (membershipError) {
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다." }, { status: 500 });
  }

  const platformAdminIds = [
    ...new Set((memberships ?? []).map((membership) => membership.user_id as string)),
  ];

  if (platformAdminIds.length === 0) {
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  const forwardedFor = req.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;

  const sessionClient = await createClient();
  for (const userId of platformAdminIds) {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    const email = data?.user?.email;
    if (error || !email) continue;

    const { data: authData, error: authError } = await sessionClient.auth.signInWithPassword({
      email,
      password,
    });
    if (!authError && authData.session) {
      // 감사 로그: 모든 본사 로그인을 기록한다(프로토타입 정책). 세션이 성립한 뒤
      // 서버에서 호출해야 auth.uid()가 잡히며, 기록 실패가 로그인 성공을 막지 않도록 한다.
      try {
        await sessionClient.rpc("record_login", { p_ip: clientIp });
      } catch {
        /* 감사 기록 실패는 무시 */
      }
      return NextResponse.json({ userId });
    }
  }

  return NextResponse.json({ error: INVALID }, { status: 401 });
}
