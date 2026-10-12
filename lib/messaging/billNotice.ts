import { chargePeriodLabel, giroSettlement, signedBillPath, type BillArrears, type BillAmountSource } from "@/lib/bill/document";
import { formatWon } from "@/lib/format/number";

/**
 * 카카오 관리비 고지서(알림톡) — 세대 유형별 템플릿 3종과 변수 규칙(결정 2026-10-12, 순수 함수).
 *
 * 템플릿 본문·버튼은 팝빌 승인 원문(0309 migration)이고, 여기서는 세대별 변수 값만 만든다.
 * 금액은 종이 지로 고지서(GiroPaper)와 같은 giroSettlement 결과를 쓴다.
 */

export type BillNoticeKind = "general" | "autoDebit" | "longOverdue";

export const BILL_NOTICE_KINDS: BillNoticeKind[] = ["general", "autoDebit", "longOverdue"];

export const BILL_NOTICE_KIND_LABELS: Record<BillNoticeKind, string> = {
  general: "일반",
  autoDebit: "자동이체",
  longOverdue: "장기미납",
};

/** message_templates.title(0309). */
export const BILL_NOTICE_TEMPLATE_TITLES: Record<BillNoticeKind, string> = {
  general: "관리비 고지(일반)",
  autoDebit: "관리비 고지(자동이체)",
  longOverdue: "관리비 고지(장기미납)",
};

/** 팝빌 승인 템플릿 코드(0309). 제목이 바뀐 경우(템플릿 동기화) 코드로 찾는다. */
export const BILL_NOTICE_TEMPLATE_CODES: Record<BillNoticeKind, string> = {
  general: "026100000610",
  autoDebit: "026100000609",
  longOverdue: "026100000608",
};

/**
 * 고지 유형(우선순위): 자동이체 → 장기미납(단전·단수 예고와 같은 판정) → 일반.
 * 자동이체이면서 장기미납이면 출금 세대이므로 자동이체 템플릿.
 */
export function billNoticeKind(target: { autoDebit: boolean; waterCutoff: boolean }): BillNoticeKind {
  if (target.autoDebit) return "autoDebit";
  if (target.waterCutoff) return "longOverdue";
  return "general";
}

/** 템플릿이 "#{호수}호" 라서 끝의 "호"를 뗀다. 동이 있으면 "101동 902" 처럼 앞에 붙인다. */
export function billNoticeUnitLabel(unitNo: string, dong: string | null | undefined): string {
  const unit = unitNo.trim().replace(/호$/, "");
  const dongText = dong?.trim() ?? "";
  if (!dongText) return unit;
  return `${dongText.endsWith("동") ? dongText : `${dongText}동`} ${unit}`;
}

/** 고객번호 = 납부자번호의 숫자만 남긴 뒤 뒤 6자리. 숫자가 없으면 null. */
export function billNoticeCustomerNo(payerNo: string | null | undefined): string | null {
  const digits = (payerNo ?? "").replace(/\D/g, "");
  return digits ? digits.slice(-6) : null;
}

/** "2026-10-31" → "2026년 10월 31일". */
export function billNoticeDate(date: string | null | undefined): string | null {
  const match = date?.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일` : null;
}

/** 관리비 기간 = 팩스 고지서와 같은 부과기간 "YYYY.MM.DD ~ YYYY.MM.DD", 없으면 "YYYY년 M월분". */
export function billNoticeChargePeriod(
  period: string,
  chargeStartDate: string | null | undefined,
  chargeEndDate: string | null | undefined,
): string {
  const label = chargePeriodLabel(chargeStartDate, chargeEndDate);
  if (label) return label;
  const [year, month] = period.split("-");
  return `${year}년 ${Number(month)}월분`;
}

export interface BillNoticeAmounts {
  /** 당월 관리비(지로 「당월계」). */
  month: number;
  /** 미납 관리비(지로 「미납액」 — 이월 미납). */
  unpaid: number;
  /** 총 납부금액(지로 「납기내금액」 — late_fee_merge 반영). */
  total: number;
}

export function billNoticeAmounts(
  document: BillAmountSource & Partial<BillArrears>,
  lateFeeMerge: boolean,
): BillNoticeAmounts {
  const settlement = giroSettlement(document, lateFeeMerge);
  return { month: settlement.monthTotal, unpaid: settlement.unpaid, total: settlement.payInDue };
}

/** 버튼 URL "https://smtsolution.kr/share/bill/#{상세경로}" 에 넣을 경로(앞의 /share/bill/ 제외). */
export function billNoticeDetailPath(link: Parameters<typeof signedBillPath>[0]): string {
  return signedBillPath(link).replace(/^\/share\/bill\//, "");
}

export interface BillNoticeVariableInput {
  kind: BillNoticeKind;
  buildingName: string;
  unitNo: string;
  dong: string | null;
  chargePeriod: string;
  dueDate: string;
  customerNo: string;
  amounts: BillNoticeAmounts;
  officePhone: string;
  detailPath: string;
}

/** 템플릿 변수명 그대로의 세대별 변수. 자동이체 템플릿은 「출금예정일」, 그 외는 「납부마감일」을 쓴다. */
export function billNoticeVariables(input: BillNoticeVariableInput): Record<string, string> {
  return {
    건물명: input.buildingName,
    호수: billNoticeUnitLabel(input.unitNo, input.dong),
    관리비기간: input.chargePeriod,
    ...(input.kind === "autoDebit" ? { 출금예정일: input.dueDate } : { 납부마감일: input.dueDate }),
    고객번호: input.customerNo,
    당월관리비: formatWon(input.amounts.month),
    미납관리비: formatWon(input.amounts.unpaid),
    총납부금액: formatWon(input.amounts.total),
    관리실연락처: input.officePhone,
    상세경로: input.detailPath,
  };
}
