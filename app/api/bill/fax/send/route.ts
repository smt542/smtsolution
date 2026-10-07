import { normalizePhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractRequestMeta, logAccess } from "@/lib/audit/accessLog";
import {
  isPopbillConfigured,
  PopbillNotConfiguredError,
  readPopbillConfig,
} from "@/lib/popbill/config";
import { loadFaxDocumentData } from "@/lib/bill/faxData";
import { renderFaxPdf } from "@/lib/bill/faxPdf";
import { isLiveRecipientAllowed, RECIPIENT_NOT_ALLOWED } from "@/lib/popbill/allowlist";
import { submitFax } from "@/lib/popbill/fax";
import { PopbillSubmitError, PopbillTimeoutError } from "@/lib/popbill/types";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * 팩스 접수 오류 분류. 설정/사전(pre-provider) 오류와 SDK 오류 콜백은 **확정 실패(failed)**,
 * 응답 없는 타임아웃/예기치 못한 post-boundary 오류만 **불명확(unknown)**으로 남긴다.
 */
function classifyFaxSubmitError(e: unknown): { outcome: "failed" | "unknown"; code: string } {
  if (e instanceof PopbillNotConfiguredError) return { outcome: "failed", code: e.code };
  if (e instanceof PopbillTimeoutError) return { outcome: "unknown", code: e.code };
  if (e instanceof PopbillSubmitError) return { outcome: "failed", code: e.code };
  // 접수 여부가 불분명한 예기치 못한 예외는 보수적으로 unknown(reconcile_required)으로 남긴다.
  return { outcome: "unknown", code: "SUBMIT_ERROR" };
}

// @react-pdf/renderer·Popbill SDK 등 Node API를 사용하므로 Node 런타임을 명시한다.
export const runtime = "nodejs";

interface FaxSendBody {
  billIssueIds: number[];
  /** 확인 모달에서 수신번호를 고친 경우. 지정되면 세대 등록 번호 대신 이 번호로 보낸다. */
  recipientOverride?: string;
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
  if (billIssueIds.length > 500) {
    return json({ error: "한 번에 최대 500건까지 전송할 수 있습니다." }, 400);
  }
  const recipientOverride =
    typeof input.recipientOverride === "string" ? normalizePhone(input.recipientOverride) : "";
  if (input.recipientOverride != null && !/^0\d{7,10}$/.test(recipientOverride)) {
    return json({ error: "invalid recipient", message: "수신 팩스번호를 확인해 주세요." }, 400);
  }

  const sb = await createClient();
  const { data: userData } = await sb.auth.getUser();
  if (!userData?.user) return json({ error: "unauthenticated" }, 401);

  const { data: ctxData, error: ctxErr } = await sb.rpc("get_my_context");
  if (ctxErr) {
    console.error("[bill/fax/send] get_my_context failed", ctxErr);
    return json({ error: "요청을 처리할 수 없습니다." }, 500);
  }
  const ctx = (Array.isArray(ctxData) ? ctxData[0] : ctxData) as
    | { org_id?: number; role?: string; permissions?: unknown }
    | null;
  const permissions = Array.isArray(ctx?.permissions) ? (ctx.permissions as string[]) : [];
  const hasBillPublish =
    ctx?.role === "org_owner" || ctx?.role === "platform_admin" || permissions.includes("bill_publish");
  if (!ctx?.org_id || !hasBillPublish) return json({ error: "forbidden" }, 403);

  // persona 게이트: field/support 파트너·세입자 세션 배제(기존 권한검사에 더한 방어).
  const { data: isManagerStaff } = await sb.rpc("current_user_is_manager_staff");
  if (isManagerStaff !== true) {
    return json({ error: "권한이 없습니다." }, 403);
  }

  if (!isPopbillConfigured()) {
    return json({ error: "PROVIDER_NOT_CONFIGURED", message: "발송 공급자가 설정되지 않았습니다." }, 503);
  }

  const admin = createAdminClient();
  const { data: setupConfig, error: setupConfigError } = await admin
    .from("setup_config")
    .select("fax_sender")
    .eq("org_id", ctx.org_id)
    .maybeSingle();
  if (setupConfigError) {
    console.error("[bill/fax/send] setup_config load failed", setupConfigError);
    return json({ error: "요청을 처리할 수 없습니다." }, 500);
  }
  const envConfig = readPopbillConfig();
  const orgFaxSender = (setupConfig as { fax_sender?: string | null } | null)?.fax_sender;
  const effectiveConfig = {
    ...envConfig,
    // 발송에 그대로 실리는 값이라 읽는 쪽에서도 숫자만 보장한다.
    faxSender: normalizePhone(orgFaxSender ?? "") || envConfig.faxSender,
  };
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
    if (recipientOverride) doc = { ...doc, faxNumber: recipientOverride };
    if (!doc.faxNumber) {
      failed += 1;
      results.push({ billIssueId, status: "no_fax_number" });
      continue;
    }
    // 라우트 계층 조직 경계 방어(심층 방어). create_fax_dispatch_job은 service_role로
    // p_bill_issue_id만 받아 RLS를 우회하므로, admin 클라이언트로 job을 만들기 전에
    // 로드된 문서의 org가 호출자 org와 일치하는지 확인한다(불일치 시 job 생성 없이 스킵).
    if (doc.orgId !== ctx.org_id) {
      skipped += 1;
      results.push({ billIssueId, status: "forbidden" });
      continue;
    }

    // 2) 세대별 독립 작업 생성(재시도는 새 attempt로 append-only). RPC 오류를 무시하지 않는다.
    const createRes = await admin.rpc("create_fax_dispatch_job", {
      p_bill_issue_id: billIssueId,
      p_provider_env: effectiveConfig.isTest ? "test" : "live",
    });
    if (createRes.error) {
      failed += 1;
      results.push({ billIssueId, status: "job_create_failed" });
      continue;
    }
    const created = createRes.data as
      | { ok?: boolean; code?: string; job_id?: number; request_num?: string; provider_ref_key?: string }
      | null;
    if (created?.code === "INSUFFICIENT_POINTS") {
      // 팝빌 포인트(본사 단일 풀) 잔액이 팩스 1장 단가보다 적다. 작업을 만들지 않았다.
      failed += 1;
      results.push({ billIssueId, status: "insufficient_points" });
      continue;
    }
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

    // 운영 모드 허용 번호 목록(spec 4.1): 목록 밖이면 팝빌을 부르지 않고 작업을 확정 실패로 마감한다.
    if (!isLiveRecipientAllowed(ctx.org_id, doc.faxNumber, effectiveConfig)) {
      const markErr = await markFaxResult(admin, {
        p_job_id: jobId,
        p_outcome: "failed",
        p_error_code: RECIPIENT_NOT_ALLOWED,
      });
      if (markErr) {
        reconcileRequired += 1;
        results.push({ billIssueId, status: "mark_failed" });
      } else {
        failed += 1;
        results.push({ billIssueId, status: "recipient_not_allowed" });
      }
      continue;
    }

    // 여기부터 submitting 작업이 DB에 존재한다. 접수 전 어떤 실패든 job을 failed로 마킹해
    // submitting 잔류(stranded)를 막고 재시도를 허용한다.
    let pdf: Buffer;
    try {
      pdf = await renderFaxPdf(doc);
    } catch {
      const markErr = await markFaxResult(admin, {
        p_job_id: jobId,
        p_outcome: "failed",
        p_error_code: "PDF_RENDER_FAILED",
      });
      if (markErr) {
        // job이 failed로 반영되지 않아 submitting으로 잔류(ALREADY_IN_FLIGHT). terminal(render_failed)로
        // 거짓 주장하지 않고 확인 대상(mark_failed)으로 남긴다(provider 접수는 하지 않았다).
        reconcileRequired += 1;
        results.push({ billIssueId, status: "mark_failed" });
      } else {
        failed += 1;
        results.push({ billIssueId, status: "render_failed" });
      }
      continue;
    }

    // 3) Popbill 접수.
    let receiptNum: string;
    try {
      const submission = await submitFax(
        {
          orgId: ctx.org_id,
          requestNum: created.request_num,
          receiver: doc.faxNumber,
          receiverName: doc.householdName,
          title: `${doc.building.name} 관리비 고지서`,
          fileName: `bill-${billIssueId}.pdf`,
          pdf,
          providerRefKey: created.provider_ref_key ?? created.request_num,
        },
        effectiveConfig,
      );
      receiptNum = submission.receiptNum;
    } catch (e) {
      // 설정/사전 오류·SDK 오류 콜백=failed(확정 실패). 타임아웃/예기치 못한 오류=unknown(reconcile_required, 재발송 금지).
      const classified = classifyFaxSubmitError(e);
      const markErr = await markFaxResult(admin, {
        p_job_id: jobId,
        p_outcome: classified.outcome,
        p_error_code: classified.code,
      });
      if (markErr) {
        // provider 접수는 없었으나(failed/unknown 모두) mark 반영이 실패해 job이 submitting으로 잔류.
        // terminal 상태로 거짓 주장하지 않고 확인 대상(mark_failed)으로 남긴다.
        reconcileRequired += 1;
        results.push({ billIssueId, status: "mark_failed" });
      } else if (classified.outcome === "failed") {
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

  if (queued > 0) {
    const { ip, userAgent } = extractRequestMeta(request);
    await logAccess({
      event: "SEND_FAX",
      persona: "manager_staff",
      orgId: ctx.org_id,
      actorId: userData.user.id,
      targetKind: "bill_issue",
      rowCount: queued,
      detail: { requestedCount: billIssueIds.length },
      ip,
      userAgent,
    });
  }

  return json({ queued, failed, skipped, reconcileRequired, results }, 202);
}

/**
 * mark RPC를 호출한다. 성공이면 null, 실패면 사유 문자열을 반환한다(던지지 않는다).
 * 실패는 **전송 오류(error)** 뿐 아니라 **응답 데이터의 실패**(`ok !== true`, 예: JOB_NOT_FOUND)도 포함한다 —
 * 데이터 실패를 무시하면 반영되지 않은 상태를 성공(queued)으로 거짓 보고하게 된다.
 * 전송 오류/예외는 유한 재시도(같은 mark만 재호출; provider 재접수 없음)로 일시 장애를 흡수한다.
 */
async function markFaxResult(
  admin: AdminClient,
  args: Record<string, unknown>,
  attempts = 2,
): Promise<string | null> {
  let lastError = "MARK_FAILED";
  for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
    try {
      const { data, error } = await admin.rpc("mark_fax_dispatch_result", args);
      if (!error) {
        const row = data as { ok?: boolean; code?: string } | null;
        // 전송 오류가 없으면 데이터 응답이 확정적이다(성공이든 실패든). 여기서 재시도하지 않는다.
        return row?.ok === true ? null : (row?.code ?? "MARK_FAILED");
      }
      lastError = error.message; // 전송 오류만 재시도 대상
    } catch (e) {
      lastError = e instanceof Error ? e.message : "mark failed";
    }
  }
  return lastError;
}
