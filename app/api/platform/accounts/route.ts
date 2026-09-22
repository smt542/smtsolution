import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginEmail } from "@/lib/auth/email";
import { generateTempPassword, toAuthPassword } from "@/lib/auth/password";

const ACCOUNT_ROLES = ["org_owner", "manager", "staff"] as const;
const STAFF_TYPES = ["manager_staff", "field_staff", "support_staff"] as const;

export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data: isPa } = await supabase.rpc("current_user_is_platform_admin");
  if (!isPa) {
    return NextResponse.json({ error: "통합관리자 권한이 필요합니다." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const { orgId, username, password, fullName, phone, role, staffType } = body ?? {};
  const numericOrgId = Number(orgId);
  if (
    !Number.isInteger(numericOrgId) ||
    numericOrgId <= 0 ||
    typeof username !== "string" ||
    !username.trim() ||
    typeof fullName !== "string" ||
    !fullName.trim() ||
    !ACCOUNT_ROLES.includes(role) ||
    !STAFF_TYPES.includes(staffType)
  ) {
    return NextResponse.json({ error: "필수 항목이 누락되었거나 올바르지 않습니다." }, { status: 422 });
  }
  if (
    password != null
    && String(password).length > 0
    && !/^\d{4}$/.test(String(password))
    && String(password).length < 6
  ) {
    return NextResponse.json({ error: "비밀번호는 숫자 4자리 또는 6자 이상으로 입력해 주세요." }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("slug")
    .eq("id", numericOrgId)
    .single();
  if (orgError || !org) {
    return NextResponse.json({ error: "대상 조직을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!org.slug) {
    return NextResponse.json({ error: "회사코드(slug)가 설정되지 않았습니다." }, { status: 409 });
  }

  const suppliedPassword = typeof password === "string" && password.length > 0;
  const accountPassword = suppliedPassword ? password : generateTempPassword();
  const email = loginEmail(org.slug, username);
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: toAuthPassword(accountPassword),
    email_confirm: true,
  });
  if (createError || !created?.user) {
    if (createError) console.error("[platform/accounts] createUser failed", createError.message);
    const duplicate = /already|exists|registered/i.test(createError?.message ?? "");
    return NextResponse.json(
      { error: duplicate ? "이미 존재하는 아이디입니다." : "계정 생성에 실패했습니다." },
      { status: duplicate ? 409 : 500 },
    );
  }

  const { error: provisionError } = await supabase.rpc("provision_member", {
    p_user_id: created.user.id,
    p_username: username,
    p_full_name: fullName,
    p_phone: phone ?? null,
    p_phone_sub: null,
    p_role: role,
    p_staff_type: staffType,
    p_permissions: [],
    p_affiliation: null,
    p_role_ids: null,
    p_target_org_id: numericOrgId,
  });
  if (provisionError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "계정 정보 저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json(
    {
      userId: created.user.id,
      ...(suppliedPassword ? {} : { tempPassword: accountPassword }),
    },
    { status: 201 },
  );
}
