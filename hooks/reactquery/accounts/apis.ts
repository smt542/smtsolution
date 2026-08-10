import { createClient } from "@/lib/supabase/client";
import type { OrgMemberRole, StaffType } from "@/hooks/reactquery/auth";

export interface Account {
  userId: string; username: string; fullName: string;
  phone: string | null; phoneSub: string | null;
  role: OrgMemberRole; staffType: StaffType; affiliation: string | null;
  isActive: boolean; permissions: string[]; roleLabels: string[];
}
export interface AccountCreateInput {
  username: string; password: string; fullName: string;
  phone?: string; phoneSub?: string;
  role: OrgMemberRole; staffType: StaffType;
  permissions: string[]; affiliation?: string; roleIds: number[];
}
export interface AccountBasicInput {
  fullName: string; phone?: string; phoneSub?: string;
  staffType: StaffType; affiliation?: string; roleIds: number[] | null;
}
export interface PermissionInput {
  role: OrgMemberRole; staffType: StaffType; permissions: string[]; roleIds: number[] | null;
}

const rowToAccount = (r: any): Account => ({
  userId: r.user_id, username: r.username, fullName: r.full_name,
  phone: r.phone, phoneSub: r.phone_sub, role: r.role, staffType: r.staff_type,
  affiliation: r.affiliation, isActive: r.is_active,
  permissions: Array.isArray(r.permissions) ? r.permissions : [],
  roleLabels: Array.isArray(r.role_labels) ? r.role_labels : [],
});

export async function listAccounts(params?: { search?: string; type?: StaffType }): Promise<Account[]> {
  const { data, error } = await createClient().rpc("list_accounts", {
    p_search: params?.search ?? null, p_type: params?.type ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToAccount);
}

export async function createAccount(input: AccountCreateInput): Promise<{ userId: string }> {
  const res = await fetch("/api/accounts", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "계정 생성에 실패했습니다.");
  return json;
}

export async function updateAccountBasic(userId: string, input: AccountBasicInput): Promise<void> {
  const { error } = await createClient().rpc("admin_update_member_basic", {
    p_user_id: userId, p_full_name: input.fullName, p_phone: input.phone ?? null,
    p_phone_sub: input.phoneSub ?? null, p_staff_type: input.staffType,
    p_affiliation: input.affiliation ?? null, p_role_ids: input.roleIds,
  });
  if (error) throw new Error(error.message);
}

export async function updatePermissions(userId: string, input: PermissionInput): Promise<void> {
  const { error } = await createClient().rpc("admin_set_member_permissions", {
    p_user_id: userId, p_role: input.role, p_staff_type: input.staffType,
    p_permissions: input.permissions, p_role_ids: input.roleIds,
  });
  if (error) throw new Error(error.message);
}

export async function setActive(userId: string, active: boolean): Promise<void> {
  const { error } = await createClient().rpc("admin_set_active", { p_user_id: userId, p_active: active });
  if (error) throw new Error(error.message);
}

export async function resetPassword(userId: string, password: string): Promise<void> {
  const res = await fetch(`/api/accounts/${userId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? "비밀번호 변경에 실패했습니다.");
  }
}
