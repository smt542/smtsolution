import { createClient } from "@/lib/supabase/client";
import type { OrgMemberRole, StaffType } from "@/hooks/reactquery/auth";

export interface PlatformCreateAccountInput {
  orgId: number;
  username: string;
  password: string;
  fullName: string;
  phone?: string | null;
  role: "org_owner" | "manager" | "staff";
  staffType: "manager_staff" | "field_staff" | "support_staff";
}

export interface PlatformCreateAccountResult {
  userId: string;
  tempPassword?: string;
}

export interface PlatformUpdateAccountInput {
  orgId: number;
  userId: string;
  fullName: string;
  phone?: string | null;
  memo?: string | null;
}

export async function createPlatformAccount(
  input: PlatformCreateAccountInput,
): Promise<PlatformCreateAccountResult> {
  const res = await fetch("/api/platform/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "계정 발급에 실패했습니다.");
  return json as PlatformCreateAccountResult;
}

export async function platformUpdateRole(
  orgId: number,
  userId: string,
  role: OrgMemberRole,
  staffType: StaffType,
  permissions: string[],
): Promise<void> {
  const { error } = await createClient().rpc("admin_set_member_permissions", {
    p_user_id: userId,
    p_role: role,
    p_staff_type: staffType,
    p_permissions: permissions,
    p_role_ids: null,
    p_target_org_id: orgId,
  });
  if (error) throw new Error(error.message);
}

export async function platformSetActive(
  orgId: number,
  userId: string,
  active: boolean,
): Promise<void> {
  const { error } = await createClient().rpc("admin_set_active", {
    p_user_id: userId,
    p_active: active,
    p_target_org_id: orgId,
  });
  if (error) throw new Error(error.message);
}

export async function platformUpdateAccount(input: PlatformUpdateAccountInput): Promise<void> {
  const { error } = await createClient().rpc("platform_update_account", {
    p_org_id: input.orgId,
    p_user_id: input.userId,
    p_full_name: input.fullName,
    p_phone: input.phone?.trim() || null,
    p_memo: input.memo?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function platformResetPassword(userId: string, password: string): Promise<void> {
  const res = await fetch(`/api/platform/accounts/${userId}/password`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "비밀번호 초기화에 실패했습니다.");
  }
}
