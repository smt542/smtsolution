import { NextResponse } from "next/server";

import {
  checkLoginRateLimit,
  equalizeLoginTiming,
  getClientIp,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/lib/auth/loginRateLimit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { toAuthPassword } from "@/lib/auth/password";

const INVALID = "아이디 또는 비밀번호가 올바르지 않습니다.";
const RATE_LIMITED = "너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해 주세요.";
const NO_ACCESS = "접근 권한이 없는 계정입니다.";
const INACTIVE = "비활성화된 계정입니다. 관리자에게 문의해 주세요.";
const SUSPENDED = "정지되었거나 사용할 수 없는 조직입니다.";
const SERVER_ERROR = "로그인 처리 중 오류가 발생했습니다.";

export async function POST(req: Request) {
  const startedAt = Date.now();
  const res = await handlePost(req);
  // 인증 결과에 따라 갈리는 실패 응답(401·403)의 타이밍을 함께 평탄화한다.
  // 401(계정 없음/비번 불일치)과 403(비번은 맞지만 비활성·정지)이 동일한 하한 지연을
  // 거쳐야, 응답시간으로 "계정 존재 + 비번 유효" 여부를 유추하는 오라클을 막을 수 있다.
  // 422(입력 누락)·429(레이트리밋)는 인증 이전 단계라 오라클이 아니므로 제외한다.
  if (res.status === 401 || res.status === 403) await equalizeLoginTiming(startedAt);
  return res;
}

async function handlePost(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { username?: unknown; password?: unknown }
    | null;
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json({ error: "아이디와 비밀번호를 입력해 주세요." }, { status: 422 });
  }

  const admin = createAdminClient();
  const ip = getClientIp(req);

  const rl = await checkLoginRateLimit(admin, { ip, username });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: RATE_LIMITED },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

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
    await recordLoginFailure(admin, { ip, username });
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  const { data: memberships, error: membershipError } = await admin
    .from("org_members")
    .select("user_id, staff_capabilities")
    .in("user_id", profileIds);

  if (membershipError) {
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }

  const officeUserIds = [
    ...new Set(
      (memberships ?? [])
        .filter(
          (m) => Array.isArray(m.staff_capabilities) && m.staff_capabilities.includes("manager_staff"),
        )
        .map((m) => m.user_id as string),
    ),
  ];
  if (officeUserIds.length === 0) {
    await recordLoginFailure(admin, { ip, username });
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  const sessionClient = await createClient();

  for (const userId of officeUserIds) {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    const email = data?.user?.email;
    if (error || !email) continue;

    const { data: authData, error: authError } = await sessionClient.auth.signInWithPassword({
      email,
      password: toAuthPassword(password),
    });
    if (authError || !authData.session) continue;

    const rejectAccess = async (message: string, status = 403) => {
      await sessionClient.auth.signOut().catch(() => undefined);
      return NextResponse.json({ error: message }, { status });
    };
    const { data: contextData, error: contextError } = await sessionClient.rpc("get_my_context");
    if (contextError) return rejectAccess(SERVER_ERROR, 500);

    const row = Array.isArray(contextData) ? contextData[0] : contextData;
    const caps = Array.isArray(row?.staff_capabilities) ? (row.staff_capabilities as string[]) : [];
    if (!row || !caps.includes("manager_staff")) return rejectAccess(NO_ACCESS);
    if (!row.is_active) return rejectAccess(INACTIVE);
    if (row.org_status !== "active") return rejectAccess(SUSPENDED);

    const context = {
      orgId: row.org_id,
      orgName: row.org_name ?? null,
      role: row.role,
      orgStatus: row.org_status,
      username: row.username,
      fullName: row.full_name,
      isActive: row.is_active,
      mustChangePassword: row.must_change_password,
      staffType: row.staff_type,
      staffCapabilities: caps,
      permissions: Array.isArray(row.permissions) ? row.permissions : [],
    };

    await recordLoginSuccess(admin, { ip, username, userId });
    return NextResponse.json(context);
  }

  await recordLoginFailure(admin, { ip, username });
  return NextResponse.json({ error: INVALID }, { status: 401 });
}
