import type { PopbillFaxResult, PopbillMessageResult } from "popbill";
import { readPopbillConfig, type PopbillConfig } from "./config";
import { getFaxService, getKakaoService, getMessageService } from "./sdk";

/**
 * Popbill 결과 조회·정규화 — **서버 전용**.
 *
 * 문자/알림톡 최종 결과는 state=3/result=100일 때만 성공이다. 접수번호(receiptNum)만으로
 * 성공을 단정하지 않는다. 조회 간격(backoff)과 결과 정규화 규칙을 한 곳에서 관리한다.
 */

export type NormalizedStatus = "success" | "failed" | "pending";

/** state=3/result=100 성공, state=3의 그 외 결과·취소는 실패, state<3은 대기. */
export function normalizeMessageResult(state: number, result: number): NormalizedStatus {
  if (state === 3) return result === 100 ? "success" : "failed";
  if (state < 3) return "pending";
  return "failed";
}

const MINUTE = 60_000;
const HOUR = 3_600_000;

/**
 * 다음 조회 시각: 최초 10분 1분, 2시간까지 5분, 24시간까지 30분, 이후 null(=reconcile_required).
 * now를 인자로 받아 결정적으로 계산한다.
 */
export function computeNextPollAt(submittedAt: Date, now: Date): Date | null {
  const age = now.getTime() - submittedAt.getTime();
  // 0327: 접수 2분 안에는 10초 뒤 재확인(DB apply_provider_dispatch_results 도 같은 규칙으로 보정한다).
  if (age < 2 * MINUTE) return new Date(now.getTime() + 10_000);
  if (age < 10 * MINUTE) return new Date(now.getTime() + MINUTE);
  if (age < 2 * HOUR) return new Date(now.getTime() + 5 * MINUTE);
  if (age < 24 * HOUR) return new Date(now.getTime() + 30 * MINUTE);
  return null;
}

export interface ProviderRecipientResult {
  providerRefKey: string;
  status: NormalizedStatus;
  /** 카카오 결과코드. 대체문자로 나간 건은 "680/alt:100"처럼 통신사 결과코드를 함께 남긴다. */
  code: string;
  /** 알림톡이 실패해 대체문자(SMS/LMS)로 실제 발송된 건의 문자 종류. 아니면 null. */
  altProduct: "sms" | "lms" | null;
}

/** 알림톡 실패 직후 대체문자 결과(altResult)가 아직 안 온 것으로 보고 기다리는 유예(ms). */
const ALT_RESULT_GRACE_MS = 3 * MINUTE;

function parseDt(value: unknown): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(value ?? ""));
  if (!m) return null;
  // 팝빌 시각은 KST.
  return Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+09:00`);
}

/**
 * 알림톡 한 건의 결과 정규화(대체문자 포함).
 *  - result=100 → 알림톡 성공.
 *  - result≠100 이고 altResult=100 → 대체문자(SMS/LMS) 성공. altContentType 4=단문, 6=장문.
 *  - result≠100, 대체문자 설정(altSendType)이 있고 altResult 미수신 → 대체문자가 진행 중이면 pending.
 *    (altSendDT/altContentType이 있거나 카카오 결과 수신 직후 유예 안이면 대기, 아니면 실패)
 *  - 그 밖은 실패.
 */
export function normalizeAlimtalkResult(
  row: {
    state?: unknown;
    result?: unknown;
    altResult?: unknown;
    altContentType?: unknown;
    altSendDT?: unknown;
    resultDT?: unknown;
  },
  altSendType: string | null | undefined,
  now: Date = new Date(),
): { status: NormalizedStatus; code: string; altProduct: "sms" | "lms" | null } {
  const state = Number(row.state);
  const result = Number(row.result);
  const base = normalizeMessageResult(state, result);
  const code = String(row.result);
  if (base !== "failed" || state !== 3) return { status: base, code, altProduct: null };
  const altResultRaw = String(row.altResult ?? "").trim();
  if (altResultRaw === "") {
    if (!altSendType) return { status: "failed", code, altProduct: null };
    const resultAt = parseDt(row.resultDT);
    const inGrace = resultAt !== null && now.getTime() - resultAt < ALT_RESULT_GRACE_MS;
    const altStarted = String(row.altSendDT ?? "").trim() !== "" || String(row.altContentType ?? "").trim() !== "";
    return { status: altStarted || inGrace ? "pending" : "failed", code, altProduct: null };
  }
  const altCode = Number(altResultRaw);
  const altProduct = Number(row.altContentType) === 6 ? "lms" : "sms";
  const combined = `${code}/alt:${altResultRaw}`;
  return altCode === 100
    ? { status: "success", code: combined, altProduct }
    : { status: "failed", code: combined, altProduct: null };
}

function toRecipientResults(
  raw: PopbillMessageResult[] | { msgs?: PopbillMessageResult[] } | null,
): ProviderRecipientResult[] {
  // 문자 조회는 배열, 알림톡 조회는 { msgs: [...] } 형태로 온다.
  const rows = Array.isArray(raw) ? raw : raw?.msgs ?? [];
  // 알림톡 조회만 { altSendType, msgs } 래퍼로 오고, 문자 조회는 배열이다.
  const isAlimtalk = !Array.isArray(raw);
  const altSendType = Array.isArray(raw) ? null : (raw as { altSendType?: string | null } | null)?.altSendType ?? null;
  return rows
    .filter((r) => typeof r.interOPRefKey === "string" && r.interOPRefKey.length > 0)
    .map((r) => {
      if (isAlimtalk) {
        return { providerRefKey: r.interOPRefKey as string, ...normalizeAlimtalkResult(r, altSendType) };
      }
      return {
        providerRefKey: r.interOPRefKey as string,
        status: normalizeMessageResult(Number(r.state), Number(r.result)),
        code: String(r.result),
        altProduct: null,
      };
    });
}

/** 접수번호로 문자/알림톡 결과를 조회해 수신자별 정규화 결과로 반환한다. */
export function fetchMessageResults(
  config: PopbillConfig,
  product: "sms" | "lms" | "alimtalk",
  receiptNum: string,
): Promise<ProviderRecipientResult[]> {
  const userId = config.userId ?? "";
  return new Promise((resolve, reject) => {
    const onSuccess = (raw: PopbillMessageResult[]) => resolve(toRecipientResults(raw));
    const onError = (e: { code: number; message: string }) =>
      reject(new Error(`provider result lookup failed (code ${e?.code ?? "?"}: ${e?.message ?? ""})`));
    if (product === "alimtalk") {
      getKakaoService(config).getMessages(config.corpNum, receiptNum, userId, onSuccess, onError);
    } else {
      getMessageService(config).getMessages(config.corpNum, receiptNum, userId, onSuccess, onError);
    }
  });
}

/** RequestNum lookup is used when a submission lease expired before its receipt was persisted. */
export function fetchMessageResultsByRequestNum(
  config: PopbillConfig,
  product: "sms" | "lms" | "alimtalk",
  requestNum: string,
): Promise<ProviderRecipientResult[]> {
  const userId = config.userId ?? "";
  return new Promise((resolve, reject) => {
    const onSuccess = (raw: PopbillMessageResult[]) => resolve(toRecipientResults(raw));
    const onError = (e: { code: number; message: string }) =>
      reject(new Error(`provider request lookup failed (code ${e?.code ?? "?"}: ${e?.message ?? ""})`));
    if (product === "alimtalk") {
      getKakaoService(config).getMessagesRN(config.corpNum, requestNum, userId, onSuccess, onError);
    } else {
      getMessageService(config).getMessagesRN(config.corpNum, requestNum, userId, onSuccess, onError);
    }
  });
}

/** reconcile에서 사용하는 기본 조회기. config 미지정 시 서버 설정을 읽는다. */
export function defaultFetchResults(job: {
  product: string;
  receiptNum: string;
  kind: string;
}, config?: PopbillConfig): Promise<ProviderRecipientResult[]> {
  const cfg = config ?? readPopbillConfig();
  return fetchMessageResults(cfg, job.product as "sms" | "lms" | "alimtalk", job.receiptNum);
}

export function defaultFetchResultsByRequestNum(
  job: { product: string; requestNum: string },
  config?: PopbillConfig,
): Promise<ProviderRecipientResult[]> {
  const cfg = config ?? readPopbillConfig();
  return fetchMessageResultsByRequestNum(
    cfg,
    job.product as "sms" | "lms" | "alimtalk",
    job.requestNum,
  );
}

// ===== 팩스 결과 =====
export interface FaxResultSummary {
  status: "success" | "partial" | "failed" | "pending";
  sendPages: number;
  successPages: number;
  failPages: number;
  chargePages: number;
  refundPages: number;
  /** 통신사 결과코드. 실패/부분 실패면 실패 행의 코드(첫 행이 아니라). */
  code: string;
  /** 팝빌 접수번호. 요청번호(RN)로 조회해 접수번호를 회수할 때 쓴다. */
  receiptNum: string | null;
}

/** 팩스 요청번호가 팝빌에 없다(-16000011) = 접수되지 않았다. */
export const FAX_REQUEST_NOT_FOUND = -16000011;

/** 결과 조회 오류. 팝빌 오류코드(code)를 보존해 "접수 안 됨"과 일시 조회 실패를 구분한다. */
export class PopbillLookupError extends Error {
  constructor(
    public readonly providerCode: number | null,
    message: string,
  ) {
    super(message);
    this.name = "PopbillLookupError";
  }
}

function toLookupError(label: string, e: { code?: number; message?: string } | null | undefined): PopbillLookupError {
  const code = typeof e?.code === "number" ? e.code : null;
  return new PopbillLookupError(code, `${label} (code ${code ?? "?"}: ${e?.message ?? ""})`);
}

/**
 * 팩스 결과 집계. state=3/result=100이 성공, 성공 페이지 기준으로 성공/부분/실패를 정한다.
 * 실제 성공 페이지(successPages)만 월 청구 원장으로 사용하고, 과금/환불 페이지는 분석용으로 보존한다.
 */
export function normalizeFaxResult(results: PopbillFaxResult[] | null): FaxResultSummary {
  const rows = results ?? [];
  // 완료(state=3)인데 성공(100)이 아닌 행이 실패 사유를 담는다.
  const failedRow = rows.find((row) => Number(row.state) === 3 && Number(row.result) !== 100);
  const sum = (field: "sendPageCnt" | "successPageCnt" | "failPageCnt" | "chargePageCnt" | "refundPageCnt") =>
    rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
  const summary = {
    sendPages: sum("sendPageCnt"),
    successPages: sum("successPageCnt"),
    failPages: sum("failPageCnt"),
    chargePages: sum("chargePageCnt"),
    refundPages: sum("refundPageCnt"),
    code: rows.length > 0 ? String((failedRow ?? rows[0]).result ?? "") : "",
    receiptNum: rows.find((row) => typeof row.receiptNum === "string" && row.receiptNum.length > 0)?.receiptNum ?? null,
  };
  if (rows.length === 0 || rows.some((row) => Number(row.state) < 3)) {
    return { status: "pending", ...summary };
  }
  const status =
    summary.successPages > 0 ? (summary.failPages > 0 ? "partial" : "success") : "failed";
  return { status, ...summary };
}

/** 접수번호로 팩스 결과를 조회해 집계한다. */
export function fetchFaxResult(config: PopbillConfig, receiptNum: string): Promise<FaxResultSummary> {
  const userId = config.userId ?? "";
  return new Promise((resolve, reject) => {
    getFaxService(config).getFaxResult(
      config.corpNum,
      receiptNum,
      userId,
      (raw) => resolve(normalizeFaxResult(raw)),
      (e) => reject(toLookupError("provider fax result lookup failed", e)),
    );
  });
}

/**
 * 요청번호(requestNum)로 팩스 결과를 조회한다. 접수 응답(receipt)을 받기 전에 타임아웃된 작업의
 * 접수 여부를 확인하는 데 쓴다. 팝빌에 요청번호가 없으면 PopbillLookupError(-16000011)로 거절한다.
 */
export function fetchFaxResultByRequestNum(config: PopbillConfig, requestNum: string): Promise<FaxResultSummary> {
  const userId = config.userId ?? "";
  return new Promise((resolve, reject) => {
    getFaxService(config).getFaxResultRN(
      config.corpNum,
      requestNum,
      userId,
      (raw) => resolve(normalizeFaxResult(raw)),
      (e) => reject(toLookupError("provider fax request lookup failed", e)),
    );
  });
}

export function defaultFetchFaxByRequestNum(
  job: { requestNum: string },
  config?: PopbillConfig,
): Promise<FaxResultSummary> {
  return fetchFaxResultByRequestNum(config ?? readPopbillConfig(), job.requestNum);
}

export function defaultFetchFax(
  job: { receiptNum: string },
  config?: PopbillConfig,
): Promise<FaxResultSummary> {
  return fetchFaxResult(config ?? readPopbillConfig(), job.receiptNum);
}
