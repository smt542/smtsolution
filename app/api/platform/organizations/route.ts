import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginEmail } from "@/lib/auth/email";
import { generateTempPassword } from "@/lib/auth/password";

export async function POST(req: Request) {
  const supabase = await createClient();

  // 1) 인증 + platform_admin 인가
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { data: isPa } = await supabase.rpc("current_user_is_platform_admin");
  if (!isPa) return NextResponse.json({ error: "통합관리자 권한이 필요합니다." }, { status: 403 });

  // 2) 검증
  const body = await req.json().catch(() => null);
  const { name, slug, phone, owner } = body ?? {};
  if (!name || !slug || !owner?.username || !owner?.fullName)
    return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 422 });

  // 3a) 조직 생성(RPC)
  const { data: org, error: orgErr } = await supabase.rpc("platform_create_organization", {
    p_name: name, p_slug: slug, p_phone: phone ?? null,
  });
  if (orgErr || !org) {
    const dup = /duplicate|unique|slug/i.test(orgErr?.message ?? "");
    return NextResponse.json(
      { error: dup ? "이미 존재하는 회사코드입니다." : "조직 생성에 실패했습니다." },
      { status: dup ? 409 : 500 });
  }
  const orgRow = Array.isArray(org) ? org[0] : org;

  // 3b) owner Auth user
  const admin = createAdminClient();
  const email = loginEmail(slug, owner.username);
  const tempPassword = generateTempPassword();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password: tempPassword, email_confirm: true,
  });
  if (createErr || !created?.user) {
    await admin.from("organizations").delete().eq("id", orgRow.id); // 보상
    const dup = /already|exists|registered/i.test(createErr?.message ?? "");
    return NextResponse.json(
      { error: dup ? "이미 존재하는 아이디입니다." : "관리자 계정 생성에 실패했습니다." },
      { status: dup ? 409 : 500 });
  }

  // 3c) owner provision(cross-org)
  const { error: rpcErr } = await supabase.rpc("provision_member", {
    p_user_id: created.user.id, p_username: owner.username, p_full_name: owner.fullName,
    p_phone: owner.phone ?? null, p_phone_sub: null,
    p_role: "org_owner", p_staff_type: "manager_staff", p_permissions: [],
    p_affiliation: null, p_role_ids: null, p_target_org_id: orgRow.id,
  });
  if (rpcErr) {
    await admin.auth.admin.deleteUser(created.user.id);       // 보상
    await admin.from("organizations").delete().eq("id", orgRow.id); // 보상
    return NextResponse.json({ error: "관리자 계정 저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json(
    { organization: { id: orgRow.id, name: orgRow.name, slug: orgRow.slug },
      owner: { username: owner.username, tempPassword } },
    { status: 201 });
}
