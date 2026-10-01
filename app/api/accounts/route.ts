import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { storeAccountLoginPin } from "@/lib/auth/loginPin";
import { loginEmail } from "@/lib/auth/email";
import { toAuthPassword } from "@/lib/auth/password";

export async function POST(req: Request) {
  const supabase = await createClient();

  // 1) 인증
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  // 2) 인가
  const { data: ctxRows } = await supabase.rpc("get_my_context");
  const ctx = Array.isArray(ctxRows) ? ctxRows[0] : ctxRows;
  if (!ctx) return NextResponse.json({ error: "조직 정보를 찾을 수 없습니다." }, { status: 403 });
  const isMaster = ctx.role === "org_owner" || ctx.role === "platform_admin";
  const perms: string[] = Array.isArray(ctx.permissions) ? ctx.permissions : [];
  if (!isMaster && !perms.includes("accounts"))
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  // persona 게이트: field/support 파트너·세입자 세션 배제(기존 권한검사에 더한 방어).
  const { data: isManagerStaff } = await supabase.rpc("current_user_is_manager_staff");
  if (isManagerStaff !== true) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  // 3) 검증
  const body = await req.json().catch(() => null);
  const { username, password, fullName, phone, phoneSub, role, staffType, permissions, affiliation, roleIds, staffCapabilities } = body ?? {};
  if (!username || !password || !fullName || !staffType)
    return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 422 });
  if (typeof password !== "string" || !/^\d{4}$/.test(password))
    return NextResponse.json({ error: "비밀번호는 숫자 4자리를 입력해 주세요." }, { status: 422 });

  // 4) 회사코드(slug)
  const { data: org } = await supabase.from("organizations").select("slug").eq("id", ctx.org_id).single();
  if (!org?.slug)
    return NextResponse.json({ error: "회사코드(slug)가 설정되지 않았습니다." }, { status: 409 });

  // 5) auth 사용자 생성
  const admin = createAdminClient();
  const email = loginEmail(org.slug, username);
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password: toAuthPassword(password), email_confirm: true,
  });
  if (createErr || !created?.user) {
    if (createErr) console.error("[accounts] createUser failed", createErr.message);
    const dup = /already|exists|registered/i.test(createErr?.message ?? "");
    return NextResponse.json(
      { error: dup ? "이미 존재하는 아이디입니다." : "계정 생성에 실패했습니다." },
      { status: dup ? 409 : 500 });
  }

  // 6) 행 삽입(RPC, 원자·감사·비마스터 역할축소는 RPC 내부에서)
  const { error: rpcErr } = await supabase.rpc("provision_member", {
    p_user_id: created.user.id, p_username: username, p_full_name: fullName,
    p_phone: phone ?? null, p_phone_sub: phoneSub ?? null,
    p_role: role ?? "staff", p_staff_type: staffType,
    p_permissions: permissions ?? [], p_affiliation: affiliation ?? null,
    p_role_ids: roleIds ?? null,
    p_staff_capabilities: staffCapabilities ?? null,
  });
  if (rpcErr) {
    console.error("[accounts] provision_member failed", rpcErr.message);
    await admin.auth.admin.deleteUser(created.user.id); // 롤백(고아 방지)
    return NextResponse.json({ error: "계정 정보 저장에 실패했습니다." }, { status: 500 });
  }
  await storeAccountLoginPin(admin, created.user.id, password, "[accounts]");
  return NextResponse.json({ userId: created.user.id }, { status: 201 });
}
