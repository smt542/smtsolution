import { createClient } from "@/lib/supabase/client";

export type OrgMemberRole =
  | "platform_admin" | "org_owner" | "manager" | "staff" | "field" | "tenant";

export type StaffType = "manager_staff" | "field_staff" | "support_staff" | "tenant";

export interface LoginInput { username: string; password: string; autoLogin: boolean }

export interface MyContext {
  orgId: number;
  role: OrgMemberRole;
  orgStatus: "active" | "suspended" | "trial";
  username: string;
  fullName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  /** 계정 유형(PRD "유형"). role과 직교. */
  staffType: StaffType;
  /** 보유 앱 접근 자격(겸직). staffType(primary)을 항상 포함. 미설정 계정은 []. */
  staffCapabilities?: StaffType[];
  /** Module permission keys granted to this user (empty for org_owner who has all). */
  permissions: string[];
}

export async function login(input: LoginInput): Promise<MyContext> {
  const response = await fetch("/api/staff/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: input.username, password: input.password }),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<MyContext> & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "로그인에 실패했습니다.");
  return data as MyContext;
}

export async function logout(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export async function getMyContext(): Promise<MyContext | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_my_context");
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    orgId: row.org_id,
    role: row.role,
    orgStatus: row.org_status,
    username: row.username,
    fullName: row.full_name,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
    staffType: row.staff_type,
    staffCapabilities: Array.isArray(row.staff_capabilities) ? row.staff_capabilities : [],
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
  };
}
