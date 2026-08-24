import type { PopbillMessageResult } from "popbill";
import { readPopbillConfig, type PopbillConfig } from "./config";
import { getKakaoService, getMessageService } from "./sdk";

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
  if (age < 10 * MINUTE) return new Date(now.getTime() + MINUTE);
  if (age < 2 * HOUR) return new Date(now.getTime() + 5 * MINUTE);
  if (age < 24 * HOUR) return new Date(now.getTime() + 30 * MINUTE);
  return null;
}

export interface ProviderRecipientResult {
  providerRefKey: string;
  status: NormalizedStatus;
  code: string;
}

function toRecipientResults(raw: PopbillMessageResult[] | null): ProviderRecipientResult[] {
  return (raw ?? [])
    .filter((r) => typeof r.interOPRefKey === "string" && r.interOPRefKey.length > 0)
    .map((r) => ({
      providerRefKey: r.interOPRefKey as string,
      status: normalizeMessageResult(Number(r.state), Number(r.result)),
      code: String(r.result),
    }));
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
      reject(new Error(`provider result lookup failed (code ${e?.code ?? "?"})`));
    if (product === "alimtalk") {
      getKakaoService(config).getMessages(config.corpNum, receiptNum, userId, onSuccess, onError);
    } else {
      getMessageService(config).getMessages(config.corpNum, receiptNum, userId, onSuccess, onError);
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
