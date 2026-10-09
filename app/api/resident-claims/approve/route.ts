import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchMessages, type SupabaseClientLike } from "@/lib/messaging/dispatch";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

type ClaimRow = {
  claim_id: number;
  claimed_name: string | null;
  claimed_phone: string | null;
  resident_phone: string | null;
  kakao_name: string | null;
  building_name: string | null;
  unit_no: string | null;
  status: string;
};

/**
 * 세대 연결 승인 + 「세대 연결 완료」 안내 발송.
 * 1) 호출자 세션으로 approve_res_claim 실행(RLS·tenants 모듈 검사 유지).
 * 2) 승인 성공 후 공용 dispatchMessages로 요청자에게 문자 발송. 발송 실패는 승인을 되돌리지 않는다.
 *
 * 채널: 승인된 알림톡 템플릿(세대 승인/연결 완료)이 DB에 없어 SMS로 보낸다.
 * TODO: 알림톡 템플릿 승인·등록 후 mode "auto" + templateId로 전환.
 */
export async function POST(request: Request): Promise<Response> {
  let input: { claimId?: number; occupancyId?: number };
  try {
    input = (await request.json()) as typeof input;
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const { claimId, occupancyId } = input;
  if (!Number.isInteger(claimId) || !Number.isInteger(occupancyId)) {
    return json({ error: "invalid input" }, 400);
  }

  const sb = await createClient();
  const { data: userData } = await sb.auth.getUser();
  if (!userData?.user) return json({ error: "unauthenticated" }, 401);

  const { error: approveErr } = await sb.rpc("approve_res_claim", {
    p_claim_id: claimId,
    p_occupancy_id: occupancyId,
  });
  if (approveErr) return json({ error: "APPROVE_FAILED", message: approveErr.message }, 400);

  // ---- 여기부터는 승인 확정 이후. 어떤 실패도 approved:true 응답을 바꾸지 않는다. ----
  const done = (notified: boolean, reason?: string) => json({ approved: true, notified, ...(reason ? { reason } : {}) });
  try {
    const { data: ctxData } = await sb.rpc("get_my_context");
    const ctx = (Array.isArray(ctxData) ? ctxData[0] : ctxData) as { org_id?: number } | null;
    const orgId = ctx?.org_id;
    if (!orgId) return done(false, "NO_ORG");

    const { data: claims } = await sb.rpc("list_res_claims", { p_status: null });
    const claim = ((claims ?? []) as ClaimRow[]).find((row) => row.claim_id === claimId);
    const phone = (claim?.claimed_phone ?? claim?.resident_phone ?? "").replace(/\D/g, "");
    if (!claim || !phone) return done(false, "NO_PHONE");

    const body =
      `[관리사무소] ${claim.building_name ?? ""} ${claim.unit_no ?? ""}호 세대 연결이 완료되었습니다. ` +
      "앱에서 고지서와 공지를 확인하실 수 있어요.";
    // kind "etc": 요청자 본인에게 보내는 서비스 처리 결과 안내 → 세대 sms_opt_in 라우팅 대상 아님.
    const recipients = [
      {
        name: claim.claimed_name ?? claim.kakao_name,
        phone,
        kind: "etc" as const,
        channel: "sms" as const,
        renderedBody: body,
      },
    ];

    const admin = createAdminClient();
    // 견적은 사용자 RPC(quote_message_points)가 messaging 모듈을 요구하므로, 승인 직원의 messaging 권한에
    // 의존하지 않도록 org가 확정된 service_role 견적(resolve_message_point_quote)으로 대체한다.
    // 예약·차감·접수는 기존 dispatch 경로(admin)를 그대로 쓴다.
    const quoteClient: SupabaseClientLike = {
      rpc: (fn, args) =>
        fn === "quote_message_points"
          ? admin.rpc("resolve_message_point_quote", { p_org_id: orgId, ...(args ?? {}) })
          : admin.rpc(fn, args),
    };
    const rawKey = request.headers.get("idempotency-key");
    const idempotencyKey = rawKey && UUID_RE.test(rawKey) ? rawKey : crypto.randomUUID();

    const result = await dispatchMessages(
      {
        orgId,
        userId: userData.user.id,
        idempotencyKey,
        mode: "sms",
        body,
        context: "세대 연결 승인",
        templateId: null,
        recipients,
      },
      { sb: quoteClient, admin },
    );
    if (!result.ok) return done(false, result.code ?? "SEND_FAILED");
    return done(true);
  } catch (error) {
    console.error("[resident-claims/approve] notify failed", error);
    return done(false, "SEND_ERROR");
  }
}
