import { createClient } from "@/lib/supabase/client";
import type { HqRole } from "./apis";

export interface PlatformCreateHqAccountInput {
  username: string;
  password: string;
  fullName: string;
  phone: string;
  memo?: string | null;
  hqRole: HqRole;
}

export interface PlatformCreateHqAccountResult {
  userId: string;
}

export interface PlatformUpdateHqAccountInput {
  userId: string;
  fullName: string;
  phone: string;
  memo?: string | null;
  hqRole: HqRole;
  isActive: boolean;
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

export async function createPlatformHqAccount(
  input: PlatformCreateHqAccountInput,
): Promise<PlatformCreateHqAccountResult> {
  const res = await fetch("/api/platform/hq-accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? "계정 발급에 실패했습니다.");
  return json as PlatformCreateHqAccountResult;
}

export function platformHqAccountRpcError(error: {
  code?: string;
  hint?: string | null;
  message: string;
}): Error & { code?: string; hint?: string | null } {
  const message = error.hint === "SELF"
    ? "본인 계정은 정지할 수 없어요."
    : error.hint === "LAST_ADMIN"
      ? "마지막 활성 본사 계정은 정지할 수 없어요."
      : error.code === "22023"
        ? "입력값을 확인해 주세요."
        : error.code === "P0002"
          ? "계정을 찾을 수 없습니다."
          : error.message;
  return Object.assign(new Error(message), { code: error.code, hint: error.hint });
}

export async function updatePlatformHqAccount(
  input: PlatformUpdateHqAccountInput,
): Promise<void> {
  const { error } = await createClient().rpc("platform_update_hq_account", {
    p_user_id: input.userId,
    p_full_name: input.fullName,
    p_phone: input.phone,
    p_memo: input.memo?.trim() || null,
    p_hq_role: input.hqRole,
    p_is_active: input.isActive,
  });
  if (error) throw platformHqAccountRpcError(error);
}

export async function deletePlatformHqAccount(userId: string): Promise<void> {
  const res = await fetch(`/api/platform/hq-accounts/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? "계정 삭제에 실패했습니다.");
}
