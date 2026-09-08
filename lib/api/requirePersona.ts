// lib/api/requirePersona.ts
import type { SupabaseClient } from "@supabase/supabase-js";

type OrgContext = {
  org_id?: number | null;
  role?: string | null;
  staff_type?: string | null;
  permissions?: unknown;
  [key: string]: unknown;
};

const PREDICATE = {
  manager_staff: "current_user_is_manager_staff",
  platform_admin: "current_user_is_platform_admin",
  field_partner: "current_user_is_field_partner",
} as const;

export type WorkforcePersona = keyof typeof PREDICATE;

/**
 * 라우트 핸들러 서버 인가: 세션 유저가 요구 persona를 보유했는지 단언한다.
 * 무세션 401, persona 불일치 403. org_id가 필요한 핸들러를 위해 ctx도 반환(requireOrgContext 드롭인).
 */
export async function requirePersonaApi(
  sb: SupabaseClient,
  persona: WorkforcePersona,
): Promise<{ ok: true; ctx: OrgContext } | { ok: false; response: Response }> {
  const { data: userData } = await sb.auth.getUser();
  if (!userData?.user) {
    return { ok: false, response: Response.json({ error: "인증이 필요합니다." }, { status: 401 }) };
  }
  const { data: allowed, error } = await sb.rpc(PREDICATE[persona]);
  if (error || allowed !== true) {
    return { ok: false, response: Response.json({ error: "권한이 없습니다." }, { status: 403 }) };
  }
  const { data: ctxData } = await sb.rpc("get_my_context");
  const ctx = (Array.isArray(ctxData) ? ctxData[0] : ctxData) as OrgContext | null;
  return { ok: true, ctx: ctx ?? {} };
}
