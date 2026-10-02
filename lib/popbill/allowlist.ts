import type { PopbillConfig } from "./config";
import { PopbillSubmitError } from "./types";

/**
 * 운영 모드 실발송 허용 번호 — **서버 전용**.
 *
 * POPBILL_IS_TEST=false일 때만 적용한다. POPBILL_LIVE_ALLOWLIST에 적힌 번호에만 실제로 보내고,
 * 목록이 비어 있으면 전부 막는다. `*`는 전체 허용이지만 POPBILL_LIVE_RESTRICTED_ORG_IDS의 조직은
 * `*`를 무시하고 목록에 적힌 번호로만 보낸다(데모 조직 보호). 두 설정 중 하나라도 형식이 틀리면 전부 막는다.
 */

export const RECIPIENT_NOT_ALLOWED = "RECIPIENT_NOT_ALLOWED" as const;

export type LiveAllowlistConfig = Pick<
  PopbillConfig,
  "isTest" | "liveAllowlist" | "liveRestrictedOrgIds" | "liveSettingsValid"
>;

/**
 * 허용 목록 원문의 형식 검사. 빈 항목은 무시하고, `*` 또는 숫자·하이픈·공백으로 된 8~12자리 번호만 허용한다.
 * 쉼표가 아닌 구분자(`;`·공백)로 이은 번호, 국제 형식(+82), 문자 섞인 값은 틀린 형식이다.
 */
export function isValidLiveAllowlist(raw: string | undefined): boolean {
  for (const entry of (raw ?? "").split(",")) {
    const trimmed = entry.trim();
    if (!trimmed || trimmed === "*") continue;
    if (!/^[\d -]+$/.test(trimmed)) return false;
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 12) return false;
  }
  return true;
}

/** 조직 id 목록 원문의 형식 검사. 빈 항목은 무시하고, 양의 정수(ASCII 숫자)만 허용한다. */
export function isValidOrgIdList(raw: string | undefined): boolean {
  for (const entry of (raw ?? "").split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    if (!/^\d+$/.test(trimmed) || Number(trimmed) <= 0) return false;
  }
  return true;
}

/** 쉼표 구분 목록 → `*` 또는 숫자만 남긴 번호. 빈 항목·숫자 없는 항목·중복은 버린다. */
export function parseLiveAllowlist(raw: string | undefined): string[] {
  const result: string[] = [];
  for (const entry of (raw ?? "").split(",")) {
    const trimmed = entry.trim();
    const value = trimmed === "*" ? "*" : trimmed.replace(/\D/g, "");
    if (value && !result.includes(value)) result.push(value);
  }
  return result;
}

/** 쉼표 구분 조직 id 목록 → 양의 정수만(중복 제거). */
export function parseOrgIdList(raw: string | undefined): number[] {
  const result: number[] = [];
  for (const entry of (raw ?? "").split(",")) {
    const trimmed = entry.trim();
    if (!/^\d+$/.test(trimmed)) continue;
    const id = Number(trimmed);
    if (id > 0 && !result.includes(id)) result.push(id);
  }
  return result;
}

export function isLiveRecipientAllowed(
  orgId: number,
  number: string,
  config: LiveAllowlistConfig,
): boolean {
  if (config.isTest) return true;
  // 허용 목록·제한 조직 설정의 형식이 틀리면 운영 모드에서 전부 막는다(데모 조직 제한이 조용히 꺼지지 않게).
  if (!config.liveSettingsValid) return false;
  const digits = number.replace(/\D/g, "");
  if (!digits) return false;
  const restricted = config.liveRestrictedOrgIds.includes(orgId);
  if (!restricted && config.liveAllowlist.includes("*")) return true;
  return config.liveAllowlist.includes(digits);
}

/** 팝빌 호출 직전 마지막 확인. 목록 밖 번호가 하나라도 있으면 SDK를 부르지 않고 던진다. */
export function assertLiveRecipientsAllowed(
  orgId: number,
  numbers: string[],
  config: LiveAllowlistConfig,
): void {
  if (numbers.some((number) => !isLiveRecipientAllowed(orgId, number, config))) {
    throw new PopbillSubmitError(RECIPIENT_NOT_ALLOWED, "운영 발송 허용 목록에 없는 번호입니다.");
  }
}
