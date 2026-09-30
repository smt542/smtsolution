import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginEmail } from "@/lib/auth/email";
import { toAuthPassword } from "@/lib/auth/password";

// 정본 신규 테넌트: 관리자 초기 비밀번호 = 숫자 4자리(Auth 저장은 toAuthPassword).
const OWNER_PIN = /^\d{4}$/;

export async function POST(req: Request) {
  const supabase = await createClient();

  // 1) 인증 + platform_admin 인가
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { data: isPa } = await supabase.rpc("current_user_is_platform_admin");
  if (!isPa) return NextResponse.json({ error: "통합관리자 권한이 필요합니다." }, { status: 403 });

  // 2) 검증
  const body = await req.json().catch(() => null);
  const {
    name,
    slug,
    phone,
    contractStartDate,
    contractEndDate,
    representativeName,
    businessRegistrationNumber,
    fax,
    email,
    address,
    region,
    operatingHours,
    contractFilePath,
    owner,
  } = body ?? {};
  if (
    !name
    || !slug
    || !phone
    || !contractStartDate
    || !contractEndDate
    || !representativeName
    || !businessRegistrationNumber
    || !fax
    || !email
    || !address
    || !region
    || !owner?.username
    || !owner?.password
  )
    return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 422 });
  if (!OWNER_PIN.test(String(owner.password)))
    return NextResponse.json({ error: "관리자 비밀번호는 숫자 4자리입니다." }, { status: 422 });

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

  // 3b) 계약 정보 저장. 실패 시 아직 계정이 없는 신규 조직만 보상 삭제한다.
  const { error: contractError } = await supabase.rpc("platform_update_organization_contract", {
    p_org_id: orgRow.id,
    p_name: name,
    p_slug: slug,
    p_phone: phone,
    p_contract_start_date: contractStartDate,
    p_contract_end_date: contractEndDate,
    p_representative_name: representativeName,
    p_business_registration_number: businessRegistrationNumber,
    p_fax: fax,
    p_email: email,
    p_address: address,
    p_region: region,
    p_operating_hours: operatingHours || null,
    p_contract_file_path: contractFilePath || null,
  });
  if (contractError) {
    await createAdminClient().from("organizations").delete().eq("id", orgRow.id);
    return NextResponse.json({ error: "계약 정보 저장에 실패했습니다." }, { status: 500 });
  }

  // 3c) owner Auth user
  const admin = createAdminClient();
  const loginAddress = loginEmail(slug, owner.username);
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: loginAddress, password: toAuthPassword(String(owner.password)), email_confirm: true,
  });
  if (createErr || !created?.user) {
    await admin.from("organizations").delete().eq("id", orgRow.id); // 보상
    const dup = /already|exists|registered/i.test(createErr?.message ?? "");
    return NextResponse.json(
      { error: dup ? "이미 존재하는 아이디입니다." : "관리자 계정 생성에 실패했습니다." },
      { status: dup ? 409 : 500 });
  }

  // 3d) owner provision(cross-org). 정본 생성 모달엔 관리자 이름·연락처 칸이 없어 이름 = 대표자명, 연락처는 비운다.
  const { error: rpcErr } = await supabase.rpc("provision_member", {
    p_user_id: created.user.id, p_username: owner.username, p_full_name: representativeName,
    p_phone: null, p_phone_sub: null,
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
      owner: { username: owner.username } },
    { status: 201 });
}
