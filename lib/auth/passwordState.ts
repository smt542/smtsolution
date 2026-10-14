import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isOfficeManagerAccount, type PasswordRule } from "@/lib/auth/passwordPolicy";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * 비밀번호 변경 필요 여부(profiles.must_change_password)를 기록한다.
 * 관리자가 발급·재설정한 비밀번호는 임시 비밀번호이므로 true, 본인이 변경하면 false.
 * 비밀번호 원문은 어디에도 저장하지 않는다(Auth 해시만 보관).
 */
export async function setMustChangePassword(
  admin: AdminClient,
  userId: string,
  value: boolean,
  source: string,
): Promise<boolean> {
  const { error } = await admin
    .from("profiles")
    .update({ must_change_password: value })
    .eq("user_id", userId);
  if (error) {
    console.error(`${source} must_change_password update failed`, error.message);
    return false;
  }
  return true;
}

/**
 * 계정에 적용할 비밀번호 규칙. 소속(org_members) 중 사무실 관리자(manager_staff, platform_admin 제외)가
 * 하나라도 있으면 숫자 4자리, 아니면 기본 규칙. 조회에 실패하면 기본 규칙으로 둔다.
 */
export async function passwordRuleForUser(admin: AdminClient, userId: string): Promise<PasswordRule> {
  const { data, error } = await admin
    .from("org_members")
    .select("role, staff_type")
    .eq("user_id", userId);
  if (error) {
    console.error("[passwordRuleForUser] org_members lookup failed", error.message);
    return "default";
  }
  return (data ?? []).some((row) => isOfficeManagerAccount({ role: row.role, staffType: row.staff_type }))
    ? "officePin"
    : "default";
}
