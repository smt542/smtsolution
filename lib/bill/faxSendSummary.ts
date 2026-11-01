/**
 * 팩스 발송 요청(`/api/bill/fax/send`) 응답을 화면 안내로 요약한다(2026-11-01 QA #25).
 *
 * 정책(서류 발행·출력 3.5): 접수 성공만 "결과 확인 중"으로 안내하고, 접수되지 않은 건
 * (이미 처리 중·접수 여부 확인 필요·실패)이 하나라도 있으면 성공 안내를 띄우지 않는다.
 */

export interface FaxSendItemResult {
  billIssueId: number;
  status: string;
  /** 접수 실패 코드(예: SENDER_NOT_REGISTERED). 서버가 보낸 경우에만. */
  code?: string;
}

export interface FaxSendResult {
  queued: number;
  failed: number;
  skipped: number;
  reconcileRequired: number;
  results: FaxSendItemResult[];
}

export const EMPTY_FAX_SEND_RESULT: FaxSendResult = {
  queued: 0,
  failed: 0,
  skipped: 0,
  reconcileRequired: 0,
  results: [],
};

export function mergeFaxSendResults(a: FaxSendResult, b: FaxSendResult): FaxSendResult {
  return {
    queued: a.queued + b.queued,
    failed: a.failed + b.failed,
    skipped: a.skipped + b.skipped,
    reconcileRequired: a.reconcileRequired + b.reconcileRequired,
    results: [...a.results, ...b.results],
  };
}

const FAILURE_CODE_REASONS: Record<string, string> = {
  SENDER_NOT_REGISTERED: "발신번호 미등록",
  PROVIDER_NOT_CONFIGURED: "발송 공급자 미설정",
  PDF_RENDER_FAILED: "고지서 PDF 생성 실패",
};

const STATUS_REASONS: Record<string, string> = {
  no_fax_number: "수신 팩스번호 없음",
  insufficient_points: "포인트 부족",
  recipient_not_allowed: "허용되지 않은 수신번호",
  render_failed: "고지서 PDF 생성 실패",
  job_create_failed: "발송 작업 생성 실패",
  forbidden: "권한 없는 고지서",
};

/** 실패 사유(중복 제거, 등장 순). */
function failureReasons(results: FaxSendItemResult[]): string[] {
  const reasons: string[] = [];
  for (const item of results) {
    let reason: string | null = null;
    if (item.status === "failed") {
      reason = item.code ? (FAILURE_CODE_REASONS[item.code] ?? `접수 실패(${item.code})`) : "접수 실패";
    } else if (STATUS_REASONS[item.status]) {
      reason = STATUS_REASONS[item.status];
    }
    if (reason && !reasons.includes(reason)) reasons.push(reason);
  }
  return reasons;
}

export interface FaxSendNotice {
  /** success: 전부 접수(결과 확인 중). warning: 실패는 없지만 접수되지 않은 건이 있음. error: 실패 포함/0건. */
  tone: "success" | "warning" | "error";
  message: string;
}

export function summarizeFaxSend(result: FaxSendResult, requestError = false): FaxSendNotice {
  const { queued, failed, skipped, reconcileRequired } = result;
  const inFlight = result.results.filter((item) => item.status === "already_in_flight").length;
  const otherSkipped = Math.max(0, skipped - inFlight);
  const notAccepted = failed + skipped + reconcileRequired;

  if (!requestError && notAccepted === 0 && queued > 0) {
    return { tone: "success", message: "발송을 접수했습니다. 결과 확인 중입니다." };
  }
  if (queued === 0 && notAccepted === 0) {
    return requestError
      ? { tone: "error", message: "발송에 실패했습니다. 실패 세대를 다시 선택해 재발송해 주세요." }
      : { tone: "error", message: "발송할 팩스 고지서가 없습니다." };
  }

  const parts: string[] = [];
  if (queued > 0) parts.push(`접수 ${queued}`);
  if (failed + otherSkipped > 0) parts.push(`실패 ${failed + otherSkipped}`);
  if (inFlight > 0) parts.push(`이전 발송 처리 중 ${inFlight}`);
  if (reconcileRequired > 0) parts.push(`접수 확인 중 ${reconcileRequired}`);

  const hints: string[] = [];
  const reasons = failureReasons(result.results);
  if (reasons.length > 0) hints.push(`사유: ${reasons.join(", ")}`);
  if (inFlight > 0) hints.push("이전 발송 결과가 확정된 뒤 다시 발송해 주세요");
  if (reconcileRequired > 0) hints.push("접수 여부를 확인하고 있어요. 확인되면 결과에 반영됩니다");
  if (requestError) hints.push("일부 건물은 요청을 처리하지 못했어요");

  const onlyUnconfirmed = failed + otherSkipped + inFlight === 0 && !requestError;
  const head = queued > 0
    ? "일부만 접수되었습니다"
    : onlyUnconfirmed ? "접수 결과를 아직 확인하지 못했습니다" : "발송이 접수되지 않았습니다";
  const counts = parts.length > 0 ? ` · ${parts.join(" · ")}` : "";
  const tone = failed + otherSkipped > 0 || requestError || (queued === 0 && !onlyUnconfirmed) ? "error" : "warning";
  return { tone, message: `${head}${counts}${hints.length > 0 ? ` — ${hints.join(" · ")}` : ""}` };
}
