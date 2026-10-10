import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

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
