import { createClient } from "@/lib/supabase/client";
import { loginEmail } from "@/lib/auth/email";

export type OrgMemberRole =
  | "platform_admin" | "org_owner" | "manager" | "staff" | "field" | "tenant";

export interface LoginInput { companyCode: string; username: string; password: string; autoLogin: boolean }

export interface MyContext {
  orgId: number;
  role: OrgMemberRole;
  orgStatus: "active" | "suspended" | "trial";
  username: string;
  fullName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  /** Module permission keys granted to this user (empty for org_owner who has all). */
  permissions: string[];
}

const INVALID_CREDS = "아이디 또는 비밀번호가 올바르지 않습니다.";

export async function login(input: LoginInput): Promise<void> {
  const supabase = createClient();
  const email = loginEmail(input.companyCode, input.username);
  // autoLogin은 세션 지속을 직접 바꾸지 않음 — AuthBoot가 부팅 시 처리(설계).
  const { error } = await supabase.auth.signInWithPassword({ email, password: input.password });
  if (error) throw new Error(INVALID_CREDS);
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
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
  };
}

export async function recordLogin(ip?: string): Promise<void> {
  const supabase = createClient();
  await supabase.rpc("record_login", { p_ip: ip ?? null });
}
