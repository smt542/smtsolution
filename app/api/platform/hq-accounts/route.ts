import { NextResponse } from "next/server";

import { loginEmail } from "@/lib/auth/email";
import { storeAccountLoginPin } from "@/lib/auth/loginPin";
import { toAuthPassword } from "@/lib/auth/password";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const HQ_ROLES = ["master", "operations", "support", "sales", "accounting", "other"] as const;
const PHONE_PATTERN = /^01[0-9]-[0-9]{3,4}-[0-9]{4}$/;
type HqRole = (typeof HQ_ROLES)[number];

function isHqRole(value: unknown): value is HqRole {
  return typeof value === "string" && HQ_ROLES.includes(value as HqRole);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const callerId = userData?.user?.id;
  if (!callerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data: isPlatformAdmin } = await supabase.rpc("current_user_is_platform_admin");
  if (!isPlatformAdmin) {
    return NextResponse.json({ error: "통합관리자 권한이 필요합니다." }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const memo = body?.memo == null
    ? null
    : typeof body.memo === "string"
      ? body.memo.trim() || null
      : undefined;
  const hqRole = body?.hqRole;

  if (
    !username
    || !/^\d{4}$/.test(password)
    || fullName.length < 1
    || fullName.length > 100
    || !PHONE_PATTERN.test(phone)
    || !isHqRole(hqRole)
    || memo === undefined
    || (memo !== null && memo.length > 500)
  ) {
    return NextResponse.json({ error: "필수 항목이 누락되었거나 올바르지 않습니다." }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data: membership, error: membershipError } = await admin
    .from("org_members")
    .select("org_id")
    .eq("user_id", callerId)
    .eq("role", "platform_admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipError) {
    console.error("[platform/hq-accounts] caller HQ membership lookup failed", membershipError.message);
    return NextResponse.json({ error: "본사 조직 정보를 확인하지 못했습니다." }, { status: 500 });
  }

  const { data: organization, error: organizationError } = membership
    ? await admin.from("organizations").select("slug").eq("id", membership.org_id).maybeSingle()
    : { data: null, error: null };
  if (organizationError) {
    console.error("[platform/hq-accounts] caller HQ organization lookup failed", organizationError.message);
    return NextResponse.json({ error: "본사 조직 정보를 확인하지 못했습니다." }, { status: 500 });
  }
  if (!organization?.slug) {
    return NextResponse.json({ error: "회사코드(slug)가 설정되지 않았습니다." }, { status: 409 });
  }

  const email = loginEmail(organization.slug, username);
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: toAuthPassword(password),
    email_confirm: true,
  });
  if (createError || !created?.user) {
    if (createError) {
      console.error("[platform/hq-accounts] createUser failed", createError.message);
    }
    const duplicate = /already|exists|registered|duplicate/i.test(createError?.message ?? "");
    return NextResponse.json(
      { error: duplicate ? "이미 사용 중인 아이디예요." : "계정 생성에 실패했습니다." },
      { status: duplicate ? 409 : 500 },
    );
  }

  const { error: provisionError } = await supabase.rpc("platform_provision_hq_account", {
    p_user_id: created.user.id,
    p_username: username,
    p_full_name: fullName,
    p_phone: phone,
    p_memo: memo,
    p_hq_role: hqRole,
  });
  if (provisionError) {
    console.error("[platform/hq-accounts] provision failed", provisionError.message);
    const { error: rollbackError } = await admin.auth.admin.deleteUser(created.user.id);
    if (rollbackError) {
      console.error("[platform/hq-accounts] auth rollback failed", created.user.id, rollbackError.message);
    }
    if (provisionError.code === "23505") {
      return NextResponse.json({ error: "이미 사용 중인 아이디예요." }, { status: 409 });
    }
    return NextResponse.json({ error: "계정 정보 저장에 실패했습니다." }, { status: 500 });
  }

  await storeAccountLoginPin(admin, created.user.id, password, "[platform/hq-accounts]");
  return NextResponse.json({ userId: created.user.id }, { status: 201 });
}
