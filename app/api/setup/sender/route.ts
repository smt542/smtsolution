import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkSenderRegistered, type SenderProduct } from "@/lib/popbill/senders";

export const runtime = "nodejs";

interface SenderBody {
  product: SenderProduct;
  number: string;
}

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(request: Request): Promise<Response> {
  let input: SenderBody;
  try {
    input = (await request.json()) as SenderBody;
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  if (
    !input ||
    (input.product !== "sms" && input.product !== "fax") ||
    typeof input.number !== "string"
  ) {
    return json({ error: "INVALID_INPUT", message: "발신번호 정보를 확인해 주세요." }, 400);
  }
  const number = input.number.replace(/\D/g, "");

  const sb = await createClient();
  const { data: userData } = await sb.auth.getUser();
  if (!userData?.user) return json({ error: "unauthenticated" }, 401);

  const { data: ctxData, error: ctxErr } = await sb.rpc("get_my_context");
  if (ctxErr) {
    console.error("[setup/sender] get_my_context failed", ctxErr);
    return json({ error: "요청을 처리할 수 없습니다." }, 500);
  }
  const ctx = (Array.isArray(ctxData) ? ctxData[0] : ctxData) as
    | { org_id?: number; role?: string; permissions?: unknown }
    | null;
  const permissions = Array.isArray(ctx?.permissions) ? (ctx.permissions as string[]) : [];
  const hasSettings =
    ctx?.role === "org_owner" || ctx?.role === "platform_admin" || permissions.includes("settings");
  if (!ctx?.org_id || !hasSettings) return json({ error: "forbidden" }, 403);

  // persona 게이트: field/support 파트너·세입자 세션 배제(기존 권한검사에 더한 방어).
  const { data: isManagerStaff } = await sb.rpc("current_user_is_manager_staff");
  if (isManagerStaff !== true) {
    return json({ error: "권한이 없습니다." }, 403);
  }

  if (number && !(await checkSenderRegistered(input.product, number))) {
    return json(
      {
        error: "SENDER_NOT_REGISTERED",
        code: "SENDER_NOT_REGISTERED",
        message: "팝빌에 등록된 발신번호가 아닙니다.",
      },
      400,
    );
  }

  const senderColumn = input.product === "sms" ? "sms_sender" : "fax_sender";
  const verifiedColumn =
    input.product === "sms" ? "sms_sender_verified_at" : "fax_sender_verified_at";
  const verifiedAt = number ? new Date().toISOString() : null;
  const admin = createAdminClient();
  const { error } = await admin.from("setup_config").upsert(
    {
      org_id: ctx.org_id,
      [senderColumn]: number || null,
      [verifiedColumn]: verifiedAt,
    },
    { onConflict: "org_id" },
  );
  if (error) {
    console.error("[setup/sender] setup_config upsert failed", error);
    return json({ error: "요청을 처리할 수 없습니다." }, 500);
  }

  return json({ product: input.product, number: number || null, verifiedAt });
}
