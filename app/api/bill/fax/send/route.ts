import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPopbillConfigured } from "@/lib/popbill/config";
import { loadFaxDocumentData } from "@/lib/bill/faxData";
import { renderFaxPdf } from "@/lib/bill/faxPdf";
import { submitFax } from "@/lib/popbill/fax";
import { PopbillSubmitError } from "@/lib/popbill/types";

// @react-pdf/renderer·Popbill SDK 등 Node API를 사용하므로 Node 런타임을 명시한다.
export const runtime = "nodejs";

interface FaxSendBody {
  billIssueIds: number[];
}

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(request: Request): Promise<Response> {
  let input: FaxSendBody;
  try {
    input = (await request.json()) as FaxSendBody;
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const billIssueIds = Array.isArray(input.billIssueIds) ? input.billIssueIds : [];
  if (billIssueIds.length === 0) return json({ error: "no bill issues" }, 400);

  const sb = await createClient();
  const { data: userData } = await sb.auth.getUser();
  if (!userData?.user) return json({ error: "unauthenticated" }, 401);

  const { data: ctxData, error: ctxErr } = await sb.rpc("get_my_context");
  if (ctxErr) return json({ error: ctxErr.message }, 500);
  const ctx = (Array.isArray(ctxData) ? ctxData[0] : ctxData) as
    | { org_id?: number; role?: string; permissions?: unknown }
    | null;
  const permissions = Array.isArray(ctx?.permissions) ? (ctx.permissions as string[]) : [];
  const hasBillPublish =
    ctx?.role === "org_owner" || ctx?.role === "platform_admin" || permissions.includes("bill_publish");
  if (!ctx?.org_id || !hasBillPublish) return json({ error: "forbidden" }, 403);

  if (!isPopbillConfigured()) {
    return json({ error: "PROVIDER_NOT_CONFIGURED", message: "발송 공급자가 설정되지 않았습니다." }, 503);
  }

  const admin = createAdminClient();
  let queued = 0;
  let failed = 0;
  let skipped = 0;
  const results: Array<{ billIssueId: number; status: string }> = [];

  for (const billIssueId of billIssueIds) {
    try {
      const doc = await loadFaxDocumentData(sb, billIssueId);
      if (!doc.faxNumber) {
        failed += 1;
        results.push({ billIssueId, status: "no_fax_number" });
        continue;
      }
      // 세대별 독립 작업 생성(재시도는 새 attempt로 append-only).
      const created = (await admin
        .rpc("create_fax_dispatch_job", { p_bill_issue_id: billIssueId })
        .then((r) => r.data)) as
        | { ok?: boolean; code?: string; job_id?: number; request_num?: string; provider_ref_key?: string }
        | null;
      if (created?.code === "ALREADY_IN_FLIGHT") {
        // 진행 중(pending/reconcile_required) 작업이 있으면 중복 전송하지 않는다.
        skipped += 1;
        results.push({ billIssueId, status: "already_in_flight" });
        continue;
      }
      if (!created?.ok || !created.request_num) {
        failed += 1;
        results.push({ billIssueId, status: "job_create_failed" });
        continue;
      }

      const pdf = await renderFaxPdf(doc);
      try {
        const submission = await submitFax({
          requestNum: created.request_num,
          receiver: doc.faxNumber,
          receiverName: doc.householdName,
          title: `${doc.building.name} 관리비 고지서`,
          fileName: `bill-${billIssueId}.pdf`,
          pdf,
          providerRefKey: created.provider_ref_key ?? created.request_num,
        });
        await admin.rpc("mark_fax_dispatch_result", {
          p_job_id: created.job_id,
          p_outcome: "accepted",
          p_receipt_num: submission.receiptNum,
        });
        queued += 1;
        results.push({ billIssueId, status: "queued" });
      } catch (e) {
        // 접수 응답 오류=failed(확정 실패), 그 외=unknown(reconcile_required, 재발송 금지).
        const outcome = e instanceof PopbillSubmitError ? "failed" : "unknown";
        await admin.rpc("mark_fax_dispatch_result", {
          p_job_id: created.job_id,
          p_outcome: outcome,
          p_error_code: e instanceof PopbillSubmitError ? e.code : "SUBMIT_ERROR",
        });
        if (outcome === "failed") {
          failed += 1;
          results.push({ billIssueId, status: "failed" });
        } else {
          queued += 1;
          results.push({ billIssueId, status: "reconcile_required" });
        }
      }
    } catch {
      failed += 1;
      results.push({ billIssueId, status: "failed" });
    }
  }

  return json({ queued, failed, skipped, results }, 202);
}
