import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPopbillConfigured } from "@/lib/popbill/config";
import { loadFaxDocumentData } from "@/lib/bill/faxData";
import { renderFaxPdf } from "@/lib/bill/faxPdf";
import { submitFax } from "@/lib/popbill/fax";
import { PopbillSubmitError } from "@/lib/popbill/types";

type AdminClient = ReturnType<typeof createAdminClient>;

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
  let reconcileRequired = 0;
  const results: Array<{ billIssueId: number; status: string }> = [];

  for (const billIssueId of billIssueIds) {
    // 1) 서버 권위 문서 로드(접수 전, job 생성 없음).
    let doc: Awaited<ReturnType<typeof loadFaxDocumentData>>;
    try {
      doc = await loadFaxDocumentData(sb, billIssueId);
    } catch {
      failed += 1;
      results.push({ billIssueId, status: "failed" });
      continue;
    }
    if (!doc.faxNumber) {
      failed += 1;
      results.push({ billIssueId, status: "no_fax_number" });
      continue;
    }

    // 2) 세대별 독립 작업 생성(재시도는 새 attempt로 append-only). RPC 오류를 무시하지 않는다.
    const createRes = await admin.rpc("create_fax_dispatch_job", { p_bill_issue_id: billIssueId });
    if (createRes.error) {
      failed += 1;
      results.push({ billIssueId, status: "job_create_failed" });
      continue;
    }
    const created = createRes.data as
      | { ok?: boolean; code?: string; job_id?: number; request_num?: string; provider_ref_key?: string }
      | null;
    if (created?.code === "ALREADY_IN_FLIGHT") {
      // 진행 중(submitting/pending/reconcile_required) 작업이 있으면 중복 전송하지 않는다.
      skipped += 1;
      results.push({ billIssueId, status: "already_in_flight" });
      continue;
    }
    if (!created?.ok || !created.request_num || created.job_id == null) {
      failed += 1;
      results.push({ billIssueId, status: "job_create_failed" });
      continue;
    }
    const jobId = created.job_id;

    // 여기부터 submitting 작업이 DB에 존재한다. 접수 전 어떤 실패든 job을 failed로 마킹해
    // submitting 잔류(stranded)를 막고 재시도를 허용한다.
    let pdf: Buffer;
    try {
      pdf = await renderFaxPdf(doc);
    } catch {
      await markFaxResult(admin, { p_job_id: jobId, p_outcome: "failed", p_error_code: "PDF_RENDER_FAILED" });
      failed += 1;
      results.push({ billIssueId, status: "render_failed" });
      continue;
    }

    // 3) Popbill 접수.
    let receiptNum: string;
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
      receiptNum = submission.receiptNum;
    } catch (e) {
      // 접수 응답 오류(SDK 콜백)=failed(확정 실패). 타임아웃/무응답=unknown(reconcile_required, 재발송 금지).
      const outcome = e instanceof PopbillSubmitError ? "failed" : "unknown";
      await markFaxResult(admin, {
        p_job_id: jobId,
        p_outcome: outcome,
        p_error_code: e instanceof PopbillSubmitError ? e.code : "SUBMIT_ERROR",
      });
      if (outcome === "failed") {
        failed += 1;
        results.push({ billIssueId, status: "failed" });
      } else {
        // receipt 없음 → queued로 보고하지 않는다(결과 확인 필요).
        reconcileRequired += 1;
        results.push({ billIssueId, status: "reconcile_required" });
      }
      continue;
    }

    // 4) 접수 성공(receipt 있음). DB 반영 실패 시 queued로 거짓 보고하지 않는다.
    const markErr = await markFaxResult(admin, {
      p_job_id: jobId,
      p_outcome: "accepted",
      p_receipt_num: receiptNum,
    });
    if (markErr) {
      // provider는 접수했으나 DB 반영 실패. 작업은 submitting으로 남아 ALREADY_IN_FLIGHT로 중복 전송을 막는다.
      // 보수적으로 확인 필요로 표기하고 queued로 세지 않는다.
      reconcileRequired += 1;
      results.push({ billIssueId, status: "mark_failed" });
      continue;
    }
    queued += 1;
    results.push({ billIssueId, status: "queued" });
  }

  return json({ queued, failed, skipped, reconcileRequired, results }, 202);
}

/** mark RPC를 호출하고 오류 메시지(있으면)를 반환한다. 오류를 던지지 않고 호출부가 보수적으로 처리하게 한다. */
async function markFaxResult(
  admin: AdminClient,
  args: Record<string, unknown>,
): Promise<string | null> {
  try {
    const { error } = await admin.rpc("mark_fax_dispatch_result", args);
    return error ? error.message : null;
  } catch (e) {
    return e instanceof Error ? e.message : "mark failed";
  }
}
