import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginEmail } from "@/lib/auth/email";
import { isValidPassword, PASSWORD_RULE_MESSAGE } from "@/lib/auth/passwordPolicy";
import { toAuthPassword } from "@/lib/auth/password";


// 정본 생성 모달엔 회사코드 칸이 없어 서버가 만든다. 관리자 로그인 이메일 {회사코드}.{아이디}@… 에만 쓰이고
// 화면엔 보이지 않는다(로그인은 아이디 단독).
function generateSlug(): string {
  return `t${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
}

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
    slug: requestedSlug,
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
    contractFilePaths,
    owner,
  } = body ?? {};
  if (
    !name
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
  // 관리자 초기 비밀번호 = 형식 자유·6자 이상. 임시 비밀번호라 첫 로그인 때 변경을 강제한다(provision_member).
  if (!isValidPassword(owner.password))
    return NextResponse.json({ error: PASSWORD_RULE_MESSAGE }, { status: 422 });

  const contractPaths: string[] = Array.isArray(contractFilePaths)
    ? contractFilePaths.filter((path: unknown): path is string => typeof path === "string" && path.trim() !== "")
    : [];

  // 3a) 조직 생성(RPC). 자동 회사코드가 겹치면(극히 드묾) 새로 만들어 다시 시도한다.
  const fixedSlug = typeof requestedSlug === "string" && requestedSlug.trim()
    ? requestedSlug.trim().toLowerCase()
    : null;
  let slug = fixedSlug ?? generateSlug();
  let { data: org, error: orgErr } = await supabase.rpc("platform_create_organization", {
    p_name: name, p_slug: slug, p_phone: phone ?? null,
  });
  for (let attempt = 0; attempt < 2 && orgErr && !fixedSlug && /duplicate|unique|slug/i.test(orgErr.message); attempt += 1) {
    slug = generateSlug();
    ({ data: org, error: orgErr } = await supabase.rpc("platform_create_organization", {
      p_name: name, p_slug: slug, p_phone: phone ?? null,
    }));
  }
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
    p_contract_file_path: contractPaths[0] ?? null,
    p_contract_file_paths: contractPaths,
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
