import { createClient } from "@/lib/supabase/server";

/**
 * 운영사 기본 발신번호(서버 env) 조회 — 화면 표시용.
 * 조직 번호(setup_config)가 없을 때 실제 발송에 쓰이는 번호를 화면에도 같은 값으로 보여 준다.
 * 비밀값은 아니지만 관리업체 직원만 조회한다.
 */

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

function digitsOrNull(value: string | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits || null;
}

export async function GET(): Promise<Response> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return json({ error: "로그인이 필요합니다." }, 401);

  const { data: contextData, error: contextError } = await supabase.rpc("get_my_context");
  if (contextError) return json({ error: "요청을 처리할 수 없습니다." }, 500);
  const row = (Array.isArray(contextData) ? contextData[0] : contextData) as { org_id?: number } | null;
  if (!row?.org_id) return json({ error: "권한이 없습니다." }, 403);

  const { data: isManagerStaff, error: personaError } = await supabase.rpc("current_user_is_manager_staff");
  if (personaError || isManagerStaff !== true) return json({ error: "권한이 없습니다." }, 403);

  return json({
    smsSender: digitsOrNull(process.env.POPBILL_SMS_SENDER),
    faxSender: digitsOrNull(process.env.POPBILL_FAX_SENDER),
  });
}
