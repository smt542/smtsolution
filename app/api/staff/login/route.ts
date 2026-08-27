import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const INVALID = "아이디 또는 비밀번호가 올바르지 않습니다.";
const NO_ACCESS = "접근 권한이 없는 계정입니다.";
const INACTIVE = "비활성화된 계정입니다. 관리자에게 문의해 주세요.";
const SUSPENDED = "정지되었거나 사용할 수 없는 조직입니다.";
const SERVER_ERROR = "로그인 처리 중 오류가 발생했습니다.";

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
    .select("user_id")
    .eq("username", username);

  if (profileError) {
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }

  const profileIds = [
    ...new Set((profiles ?? []).map((profile) => profile.user_id as string)),
  ];
  if (profileIds.length === 0) {
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  const { data: memberships, error: membershipError } = await admin
    .from("org_members")
    .select("user_id")
    .in("user_id", profileIds)
    .eq("staff_type", "manager_staff");

  if (membershipError) {
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }

  const officeUserIds = [
    ...new Set((memberships ?? []).map((membership) => membership.user_id as string)),
  ];
  if (officeUserIds.length === 0) {
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  const forwardedFor = req.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  const sessionClient = await createClient();

  for (const userId of officeUserIds) {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    const email = data?.user?.email;
    if (error || !email) continue;

    const { data: authData, error: authError } = await sessionClient.auth.signInWithPassword({
      email,
      password,
    });
    if (authError || !authData.session) continue;

    const rejectAccess = async (message: string, status = 403) => {
      await sessionClient.auth.signOut().catch(() => undefined);
      return NextResponse.json({ error: message }, { status });
    };
    const { data: contextData, error: contextError } = await sessionClient.rpc("get_my_context");
    if (contextError) return rejectAccess(SERVER_ERROR, 500);

    const row = Array.isArray(contextData) ? contextData[0] : contextData;
    if (!row || row.staff_type !== "manager_staff") return rejectAccess(NO_ACCESS);
    if (!row.is_active) return rejectAccess(INACTIVE);
    if (row.org_status !== "active") return rejectAccess(SUSPENDED);

    const context = {
      orgId: row.org_id,
      role: row.role,
      orgStatus: row.org_status,
      username: row.username,
      fullName: row.full_name,
      isActive: row.is_active,
      mustChangePassword: row.must_change_password,
      staffType: row.staff_type,
      permissions: Array.isArray(row.permissions) ? row.permissions : [],
    };

    try {
      await sessionClient.rpc("record_login", { p_ip: clientIp });
    } catch {
      /* 감사 기록 실패는 로그인 성공을 막지 않는다. */
    }
    return NextResponse.json(context);
  }

  return NextResponse.json({ error: INVALID }, { status: 401 });
}
