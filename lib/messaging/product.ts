import type { MessageProduct } from "./preset";

/**
 * 문자 제품 분류 — Popbill 바이트 규칙 기준.
 *
 * Popbill은 ASCII 코드포인트를 1바이트, 그 외(한글·이모지 등)를 2바이트로 센다.
 * 견적·예약·정산·월 청구가 모두 같은 판정을 쓰도록 이 함수를 단일 기준으로 사용한다.
 * DB의 동일 바이트 함수(0096)와 규칙이 일치해야 한다.
 */

/** SMS 단문 한도(바이트). 이하이면 sms. */
export const SMS_MAX_BYTES = 90;
/** LMS 장문 한도(바이트). 초과하면 접수 전에 거절한다. */
export const LMS_MAX_BYTES = 2000;

export type ClassifyResult =
  | { ok: true; product: Extract<MessageProduct, "sms" | "lms">; bytes: number }
  | { ok: false; code: "MESSAGE_TOO_LONG"; bytes: number };

/** Popbill 바이트 길이: ASCII 1바이트, 그 외 2바이트(코드포인트 단위). */
export function popbillByteLength(text: string): number {
  let bytes = 0;
  for (const ch of text) {
    bytes += (ch.codePointAt(0) ?? 0) <= 0x7f ? 1 : 2;
  }
  return bytes;
}

/**
 * 렌더링된 최종 본문(+선택 제목)으로 sms/lms를 판정한다.
 * 제목이 있으면(공백 제외) SMS로 접수할 수 없으므로 lms로 승격한다.
 * 2000바이트 초과는 MESSAGE_TOO_LONG으로 거절한다.
 */
export function classifyMessageProduct(body: string, subject?: string): ClassifyResult {
  const bytes = popbillByteLength(body);
  if (bytes > LMS_MAX_BYTES) {
    return { ok: false, code: "MESSAGE_TOO_LONG", bytes };
  }
  const hasSubject = typeof subject === "string" && subject.trim().length > 0;
  const product = bytes > SMS_MAX_BYTES || hasSubject ? "lms" : "sms";
  return { ok: true, product, bytes };
}
