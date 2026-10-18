// lib/auth/requirePersona.ts — 서버 전용(내부에서 next/headers cookies 사용).
// 서버 컴포넌트 게이트와 app/api/auth/switch-entry가 같이 쓴다.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ORG_SUSPENDED_ERROR } from "@/lib/auth/orgSuspended";

const PREDICATE = {
  manager_staff: "current_user_is_manager_staff",
  platform_admin: "current_user_is_platform_admin",
  field_partner: "current_user_is_field_partner",
} as const;

export type WorkforcePersona = keyof typeof PREDICATE;

/** 엔트리 포인트(로그인 화면 단위)별 경로. 키가 `/api/auth/switch-entry?to=` 값이다. */
export const ENTRY_PATHS = {
  manager_staff: { login: "/staff/login", home: "/staff" },
  platform_admin: { login: "/platform-admin/login", home: "/platform-admin" },
  field_partner: { login: "/partner/mobile-login", home: "/partner/mobile-home" },
  resident: { login: "/resident/login", home: "/resident/home" },
} as const;

export type EntryPersona = keyof typeof ENTRY_PATHS;

export function isEntryPersona(value: string | null): value is EntryPersona {
  return value !== null && Object.prototype.hasOwnProperty.call(ENTRY_PATHS, value);
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** 이 세션이 그 엔트리 포인트의 역할을 가졌나. 입주민=resident_identities 행 보유. 조회 실패는 null. */
export async function hasEntryPersona(
  sb: ServerClient,
  persona: EntryPersona,
  userId: string,
): Promise<boolean | null> {
  if (persona === "resident") {
    const { data, error } = await sb
      .from("resident_identities")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    return error ? null : data !== null;
  }
  const { data, error } = await sb.rpc(PREDICATE[persona]);
  return error ? null : data === true;
}

/**
 * 이 세션의 테넌트가 정지(계약 만료 포함)·해지됐나. 직원=get_my_context의 org_status,
 * 입주민=resident_org_suspended(운영 조직 세대가 없고 정지 조직에만 묶임). 조회 실패는 null.
 */
export async function isOrgSuspended(
  sb: ServerClient,
  persona: EntryPersona,
): Promise<boolean | null> {
  if (persona === "platform_admin") return false;
  if (persona === "resident") {
    const { data, error } = await sb.rpc("resident_org_suspended");
    return error ? null : data === true;
  }
  const { data, error } = await sb.rpc("get_my_context");
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? row.org_status !== "active" : false;
}

/** 역할이 안 맞는 세션을 이 브라우저에서 끊고 그 영역 로그인 화면으로 보내는 경로. */
function switchEntryPath(persona: EntryPersona): string {
  return `/api/auth/switch-entry?to=${persona}`;
}

/** 정지 테넌트 세션을 끊고 그 영역 로그인 화면(안내 문구 포함)으로 보내는 경로. */
function orgSuspendedPath(persona: EntryPersona): string {
  return `/api/auth/switch-entry?to=${persona}&reason=${ORG_SUSPENDED_ERROR}`;
}

/**
 * 무세션→loginPath, 다른 엔트리 포인트로 들어온 세션→switch-entry(세션 끊고 이 영역 로그인),
 * 역할 조회 실패→중립 '/'(게이트 밖, 루프 방지·로그아웃하지 않음).
 */
export async function requirePersona(persona: WorkforcePersona, loginPath: string): Promise<void> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect(loginPath);
  const allowed = await hasEntryPersona(sb, persona, user.id);
  if (allowed === null) redirect("/");
  if (!allowed) redirect(switchEntryPath(persona));
  // 로그인 후 테넌트가 정지(매일 KST 0시 계약 만료 정지 포함)되면 다음 화면 진입에서 세션을 끊는다.
  if ((await isOrgSuspended(sb, persona)) === true) redirect(orgSuspendedPath(persona));
}

/**
 * resident: 무세션→/resident/login, 입주민 계정이 아닌 세션(직원 등)→switch-entry,
 * 세대 미연결 입주민→/resident/verify.
 */
export async function requireResidentLink(): Promise<void> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/resident/login");
  const { data: rows } = await sb.rpc("resident_my_link");
  const link = Array.isArray(rows) ? rows[0] : rows;
  if (link) return;
  // 세대가 없을 때만 입주민 계정인지 본다(연결된 입주민은 추가 조회 없음).
  if ((await hasEntryPersona(sb, "resident", user.id)) === false) {
    redirect(switchEntryPath("resident"));
  }
  // 세대가 정지 테넌트에만 묶였으면 본인인증으로 보내지 않고 세션을 끊는다.
  if ((await isOrgSuspended(sb, "resident")) === true) redirect(orgSuspendedPath("resident"));
  redirect("/resident/verify");
}
