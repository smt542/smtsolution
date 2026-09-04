import type { SupabaseClient } from "@supabase/supabase-js";

type OrgContext = {
  org_id?: number | null;
  role?: string | null;
  permissions?: unknown;
  [key: string]: unknown;
};

/**
 * 라우트 진입 시 명시적 인증·조직 컨텍스트 가드(심층 방어).
 * 하위 SECURITY DEFINER RPC의 org 자기-스코핑을 대체하지 않고 앞단에 게이트를 추가한다.
 */
export async function requireOrgContext(
  sb: SupabaseClient,
): Promise<{ ok: true; ctx: OrgContext } | { ok: false; response: Response }> {
  const { data: userData } = await sb.auth.getUser();
  if (!userData?.user) {
    return { ok: false, response: Response.json({ error: "인증이 필요합니다." }, { status: 401 }) };
  }
  const { data: ctxData, error } = await sb.rpc("get_my_context");
  const ctx = (Array.isArray(ctxData) ? ctxData[0] : ctxData) as OrgContext | null;
  if (error || !ctx?.org_id) {
    return { ok: false, response: Response.json({ error: "권한이 없습니다." }, { status: 403 }) };
  }
  return { ok: true, ctx };
}
