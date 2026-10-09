// lib/bill/document.ts
import { defaultChargePeriod } from "@/lib/billing/period";
import { formatWon } from "@/lib/format";

export const PROGRAM_COMPANY_NAME = "관리비서";

export type BillNameDisplay = "none" | "name" | "code";

/** units.unit_no는 이미 `101호` 형태로 저장돼 있다 — 없을 때만 `호`를 붙인다(중복 방지). */
export function displayUnitNo(unitNo: string | null | undefined): string {
  if (!unitNo) return "";
  return unitNo.endsWith("호") ? unitNo : `${unitNo}호`;
}

export function unitLabel(
  mode: BillNameDisplay,
  unitNo: string,
  tenantName: string | null,
  payerName: string | null = null,
  payerNo: string | null = null,
): string {
  if (mode === "none") return "";
  if (mode === "code") return payerNo?.trim() || unitNo;
  return payerName?.trim() || tenantName?.trim() || unitNo;
}

/**
 * 서명 무로그인 고지서 상세 경로 `/share/bill/{building}/{unit}/{YYYY-MM}?s={sig}`.
 * period는 "YYYY-MM" 또는 "YYYY-MM-01" 모두 허용(앞 7자만 사용).
 * sig는 base64url(URL-safe)이라 별도 인코딩 불필요, unit_no만 인코딩한다.
 */
export function signedBillPath(link: {
  buildingId: number;
  unitNo: string;
  period: string;
  sig: string;
  issuedDay?: number | null;
}): string {
  // issued_day를 반환하지 않는 DB(마이그 0175 미적용)에서는 d를 붙이지 않는다. 그러면
  // 검증기가 4-arg 레거시 경로를 타서, 코드가 마이그레이션보다 먼저 배포돼도 현행
  // 동작을 그대로 유지한다(Amplify 배포와 DB 적용은 원자적이지 않다).
  const issuedDayQuery =
    typeof link.issuedDay === "number" && Number.isFinite(link.issuedDay)
      ? `&d=${link.issuedDay}`
      : "";
  return `/share/bill/${link.buildingId}/${encodeURIComponent(link.unitNo)}/${link.period.slice(0, 7)}?s=${link.sig}${issuedDayQuery}`;
}

/**
 * 종이 고지서 QR에 넣는 공개 고지서 전체 URL(`NEXT_PUBLIC_BASE_URL` + 서명 경로).
 * 기준 주소가 없으면 빈 문자열을 돌려 QR을 그리지 않게 한다(임의 도메인을 인쇄하지 않는다).
 */
export function publicBillUrl(link: Parameters<typeof signedBillPath>[0]): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, "");
  return base ? `${base}${signedBillPath(link)}` : "";
}

export interface PrintableAccount { bank: string; acct: string; holder: string; }
export interface AccountConfig {
  mgmtBank1?: string | null; mgmtAcct1?: string | null; mgmtHolder1?: string | null; mgmtPrint1?: boolean;
  mgmtBank2?: string | null; mgmtAcct2?: string | null; mgmtHolder2?: string | null; mgmtPrint2?: boolean;
}
export function printableAccounts(config: AccountConfig | null | undefined): PrintableAccount[] {
  if (!config) return [];
  const out: PrintableAccount[] = [];
  if (config.mgmtPrint1 && (config.mgmtBank1 || config.mgmtAcct1))
    out.push({ bank: config.mgmtBank1 ?? "", acct: config.mgmtAcct1 ?? "", holder: config.mgmtHolder1 ?? "" });
  if (config.mgmtPrint2 && (config.mgmtBank2 || config.mgmtAcct2))
    out.push({ bank: config.mgmtBank2 ?? "", acct: config.mgmtAcct2 ?? "", holder: config.mgmtHolder2 ?? "" });
  return out;
}

export interface BillItem { feeItemId: number; name: string; charged: boolean; amount: number; }
export function billDocumentTotal(items: BillItem[]): number {
  return items.reduce((s, i) => (i.charged ? s + i.amount : s), 0);
}

export interface BillAmountSource {
  totalAmount: number;
  items: BillItem[];
}

/** Confirmed billing total is authoritative; item summing is only a malformed-data fallback. */
export function giroDocumentAmount(document: BillAmountSource): number {
  return Number.isFinite(document.totalAmount)
    ? document.totalAmount
    : billDocumentTotal(document.items);
}

export function formatBillAmount(amount: number): string {
  return formatWon(amount);
}

// ===== 고지서 미납·연체료 (개선3차 #2) =====
/**
 * 고지서 1장의 연체료·이월 미납. 세입자 상세(resident_bill_detail)와 같은 정의다.
 * lateFee = 당월 미납 × 누적요율 × late_fee_factor, carryover* = bill_carryover(unit, period).
 */
export interface BillArrears {
  lateFee: number;
  carryoverUnpaid: number;
  carryoverLateFee: number;
}

/** 지로 서식 하단 5행(당월계·미납액·납기내금액·납기후연체·납기후금액) + 미납내역 합계. */
export interface GiroSettlement {
  monthTotal: number;
  /** 이월 미납(항상 표시). */
  unpaid: number;
  /** 당월+이월 연체료. */
  lateFee: number;
  /** 납기내금액 = 당월계 + 미납액 (+ 연체료: 합산 모드). */
  payInDue: number;
  /** 납기후연체 행. 합산 모드면 납기내금액에 이미 포함돼 0. */
  postDueLateFee: number;
  /** 납기후금액 = 납기내금액 + 납기후연체. */
  payAfterDue: number;
  /** 미납내역 합계 = 이월 미납 + 연체료. */
  arrearsTotal: number;
  merged: boolean;
}

/**
 * 총액 = 당월 부과액 + 미납액(이월) + 연체료(당월+이월) — 세입자 상세고지서 3.4 와 같은 식.
 * late_fee_merge(셋업 "연체료 합산 구분")가 true 면 연체료를 납기내금액에 합산하고,
 * false 면 납기후연체·납기후금액 행으로 구분한다.
 */
export function giroSettlement(
  document: BillAmountSource & Partial<BillArrears>,
  lateFeeMerge: boolean,
): GiroSettlement {
  const monthTotal = giroDocumentAmount(document);
  const unpaid = Math.max(document.carryoverUnpaid ?? 0, 0);
  const lateFee = Math.max(document.lateFee ?? 0, 0) + Math.max(document.carryoverLateFee ?? 0, 0);
  const base = monthTotal + unpaid;
  const payInDue = lateFeeMerge ? base + lateFee : base;
  const postDueLateFee = lateFeeMerge ? 0 : lateFee;
  return {
    monthTotal,
    unpaid,
    lateFee,
    payInDue,
    postDueLateFee,
    payAfterDue: payInDue + postDueLateFee,
    arrearsTotal: unpaid + lateFee,
    merged: lateFeeMerge,
  };
}

// ===== 셋업 고지서 출력 옵션 (개선3차 #3) =====
/** setup_config 출력 옵션. print_utility_cutoff(단전·단수)는 기존 도장 흐름이 담당한다. */
export interface BillPrintOptions {
  /** print_water_unit_price — 수도 단가 출력. */
  waterUnitPrice: boolean;
  /** print_billing_period — 관리비 기간(billing_period_settings 부과기간) 출력. */
  billingPeriod: boolean;
  /** print_delta — 전월 대비 사용량 증감 표시. */
  delta: boolean;
  /** late_fee_merge — 연체료 합산(true)/구분(false). */
  lateFeeMerge: boolean;
}

export const DEFAULT_BILL_PRINT_OPTIONS: BillPrintOptions = {
  waterUnitPrice: false,
  billingPeriod: false,
  delta: false,
  lateFeeMerge: false,
};

export type MeterUtility = "elec" | "water" | "gas";

/** meter_readings 1행(당월 포함 최근 6개월). period = "YYYY-MM". */
export interface BillMeterReading {
  utility: MeterUtility;
  period: string;
  usage: number | null;
  previousReading: number | null;
  currentReading: number | null;
  unitPrice: number | null;
}

export interface BillMeterReadingRow {
  utility: string;
  period: string;
  usage: number | string | null;
  previous_reading: number | string | null;
  current_reading: number | string | null;
  unit_price: number | string | null;
}

function numberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toBillMeterReadings(rows: BillMeterReadingRow[] | null | undefined): BillMeterReading[] {
  return (rows ?? []).flatMap((row) => (
    row.utility === "elec" || row.utility === "water" || row.utility === "gas"
      ? [{
          utility: row.utility,
          period: row.period.slice(0, 7),
          usage: numberOrNull(row.usage),
          previousReading: numberOrNull(row.previous_reading),
          currentReading: numberOrNull(row.current_reading),
          unitPrice: numberOrNull(row.unit_price),
        }]
      : []
  ));
}

/** 부과 항목명 → 공과금 구분(세입자 상세 resident_bill_detail 과 같은 이름 규칙). */
export function utilityOfItemName(name: string): MeterUtility | null {
  if (name.includes("수도")) return "water";
  if (name.includes("전기")) return "elec";
  if (name.includes("가스")) return "gas";
  return null;
}

export function shiftBillPeriod(period: string, months: number): string {
  const [year, month] = period.slice(0, 7).split("-").map(Number);
  const base = new Date(year, month - 1 + months, 1);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;
}

export function meterReadingFor(
  meters: BillMeterReading[] | undefined,
  utility: MeterUtility,
  period: string,
): BillMeterReading | null {
  const key = period.slice(0, 7);
  return meters?.find((meter) => meter.utility === utility && meter.period === key) ?? null;
}

export interface MeterTrendRow {
  /** "YYYY.MM" */
  label: string;
  elecUsage: number | null;
  elecPrevUsage: number | null;
  elecDelta: number | null;
  waterUsage: number | null;
  waterPrevUsage: number | null;
  waterDelta: number | null;
}

/** 당월부터 거슬러 n개월 사용량 추이(금량·전량·증감). 증감 = 금량 − 전월 사용량. */
export function meterTrend(meters: BillMeterReading[] | undefined, period: string, months = 5): MeterTrendRow[] {
  const usage = (utility: MeterUtility, key: string) => meterReadingFor(meters, utility, key)?.usage ?? null;
  const delta = (current: number | null, previous: number | null) =>
    current === null || previous === null ? null : current - previous;
  return Array.from({ length: months }, (_, index) => {
    const key = shiftBillPeriod(period, -index);
    const prevKey = shiftBillPeriod(period, -index - 1);
    const elecUsage = usage("elec", key);
    const elecPrevUsage = usage("elec", prevKey);
    const waterUsage = usage("water", key);
    const waterPrevUsage = usage("water", prevKey);
    return {
      label: key.replace("-", "."),
      elecUsage,
      elecPrevUsage,
      elecDelta: delta(elecUsage, elecPrevUsage),
      waterUsage,
      waterPrevUsage,
      waterDelta: delta(waterUsage, waterPrevUsage),
    };
  });
}

/** 관리비 기간 "YYYY.MM.DD ~ YYYY.MM.DD". 값이 없으면 빈 문자열. */
export function chargePeriodLabel(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return "";
  const dot = (value: string) => value.slice(0, 10).replace(/-/g, ".");
  return `${dot(start)} ~ ${dot(end)}`;
}

export function formatMeterNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : value.toLocaleString("ko-KR");
}

/** 지로 서식 하단 행(당월계·미납액·납기내금액·납기후연체·납기후금액). 합산 모드면 연체료 상세 행을 덧붙인다. */
export function giroSettlementRows(settlement: GiroSettlement): { label: string; amount: number }[] {
  return [
    { label: "당월계", amount: settlement.monthTotal },
    { label: "미납액", amount: settlement.unpaid },
    ...(settlement.merged && settlement.lateFee > 0 ? [{ label: "연체료(합산)", amount: settlement.lateFee }] : []),
    { label: "납기내금액", amount: settlement.payInDue },
    { label: "납기후연체", amount: settlement.postDueLateFee },
    { label: "납기후금액", amount: settlement.payAfterDue },
  ];
}

/** 공과금 항목 사용량 요약(당월·전월 지침, 사용량, 증감, 수도 단가) — 출력 옵션 반영. */
export function meterSummary(
  itemName: string,
  meters: BillMeterReading[] | undefined,
  period: string,
  options: BillPrintOptions,
): string {
  const utility = utilityOfItemName(itemName);
  if (!utility) return "";
  const current = meterReadingFor(meters, utility, period);
  if (!current) return "";
  const parts = [`사용량 ${formatMeterNumber(current.usage)}`];
  if (options.delta) {
    const previous = meterReadingFor(meters, utility, shiftBillPeriod(period, -1));
    if (current.usage !== null && previous?.usage !== null && previous?.usage !== undefined) {
      const delta = current.usage - previous.usage;
      parts.push(`전월 ${formatMeterNumber(previous.usage)} · 증감 ${delta > 0 ? "+" : ""}${formatMeterNumber(delta)}`);
    }
  }
  if (utility === "water" && options.waterUnitPrice && current.unitPrice !== null) {
    parts.push(`단가 ${formatMeterNumber(current.unitPrice)}원`);
  }
  return parts.join(" · ");
}

// ===== 팩스 문서 서버 데이터 계약 (load_fax_document RPC → 렌더러) =====
/** load_fax_document RPC가 반환하는 원시 행(스네이크 케이스). */
export interface FaxDocumentRow {
  bill_issue_id: number;
  org_id: number;
  company_name: string | null;
  building: { id: number; name: string; address: string | null };
  unit_id: number;
  unit_no: string;
  dong: string | null;
  period: string;
  tenant_name: string | null;
  payer_name: string | null;
  payer_no: string | null;
  bill_name_display: BillNameDisplay;
  phone: string | null;
  fax_number: string | null;
  auto_debit: boolean;
  amount: number;
  items: BillItem[] | null;
  unit_notice: string | null;
  customer_notice: string | null;
  due_date: string | null;
  mgmt_bank1: string | null; mgmt_acct1: string | null; mgmt_holder1: string | null; mgmt_print1: boolean;
  mgmt_bank2: string | null; mgmt_acct2: string | null; mgmt_holder2: string | null; mgmt_print2: boolean;
  /** 0264 이후: 세입자 상세와 같은 정의의 연체료·이월 미납, 검침 이력, 셋업 출력 옵션, 부과기간. */
  late_fee?: number | null;
  carryover_unpaid?: number | null;
  carryover_late_fee?: number | null;
  meters?: BillMeterReadingRow[] | null;
  late_fee_merge?: boolean | null;
  print_water_unit_price?: boolean | null;
  print_billing_period?: boolean | null;
  print_delta?: boolean | null;
  charge_start_date?: string | null;
  charge_end_date?: string | null;
}

/** 팩스 PDF 렌더러가 사용하는 정규화된 문서 데이터. GiroPrintView와 동일한 핵심 값을 담는다. */
export interface FaxDocumentData {
  billIssueId: number;
  orgId: number;
  companyName: string;
  building: { id: number; name: string; address: string | null };
  unitId: number;
  unitNo: string;
  dong: string | null;
  period: string;
  householdName: string;
  phone: string | null;
  faxNumber: string | null;
  autoDebit: boolean;
  amount: number;
  items: BillItem[];
  accounts: PrintableAccount[];
  customerNotice: string | null;
  unitNotice: string | null;
  dueDate: string | null;
  /** 당월계·미납액·납기내금액·납기후연체·납기후금액(late_fee_merge 반영). */
  settlement: GiroSettlement;
  meters: BillMeterReading[];
  printOptions: BillPrintOptions;
  /** 관리비 기간(billing_period_settings). 미설정이면 기본 부과기간. */
  chargeStartDate: string;
  chargeEndDate: string;
  /** 공개 고지서 URL. 서명 링크를 발급하지 못했거나 기준 주소가 없으면 빈 문자열(QR 생략). */
  qrPayload: string;
}

/** 서버 원시 행을 렌더러 계약으로 변환한다. 금액/계좌/이름은 서버 값만 사용한다(클라이언트 불신뢰). */
export function buildFaxDocument(row: FaxDocumentRow): FaxDocumentData {
  const items = (row.items ?? []).filter((item) => item.charged);
  const accounts = printableAccounts({
    mgmtBank1: row.mgmt_bank1, mgmtAcct1: row.mgmt_acct1, mgmtHolder1: row.mgmt_holder1, mgmtPrint1: row.mgmt_print1,
    mgmtBank2: row.mgmt_bank2, mgmtAcct2: row.mgmt_acct2, mgmtHolder2: row.mgmt_holder2, mgmtPrint2: row.mgmt_print2,
  });
  const printOptions: BillPrintOptions = {
    waterUnitPrice: row.print_water_unit_price ?? false,
    billingPeriod: row.print_billing_period ?? false,
    delta: row.print_delta ?? false,
    lateFeeMerge: row.late_fee_merge ?? false,
  };
  const defaultCharge = defaultChargePeriod(`${row.period.slice(0, 7)}-01`);
  return {
    billIssueId: row.bill_issue_id,
    orgId: row.org_id,
    companyName: row.company_name?.trim() || PROGRAM_COMPANY_NAME,
    building: row.building,
    unitId: row.unit_id,
    unitNo: row.unit_no,
    dong: row.dong,
    period: row.period,
    householdName: unitLabel(row.bill_name_display, row.unit_no, row.tenant_name, row.payer_name, row.payer_no),
    phone: row.phone,
    faxNumber: row.fax_number,
    autoDebit: row.auto_debit,
    amount: giroDocumentAmount({ totalAmount: row.amount, items }),
    items,
    accounts,
    customerNotice: row.customer_notice,
    unitNotice: row.unit_notice,
    dueDate: row.due_date,
    settlement: giroSettlement({
      totalAmount: row.amount,
      items,
      lateFee: row.late_fee ?? 0,
      carryoverUnpaid: row.carryover_unpaid ?? 0,
      carryoverLateFee: row.carryover_late_fee ?? 0,
    }, printOptions.lateFeeMerge),
    meters: toBillMeterReadings(row.meters),
    printOptions,
    chargeStartDate: row.charge_start_date ?? defaultCharge.chargeStartDate,
    chargeEndDate: row.charge_end_date ?? defaultCharge.chargeEndDate,
    qrPayload: "",
  };
}

export interface AdjustmentSource extends BillAmountSource {
  unitId: number;
  unitNo: string;
  dong: string | null;
  tenantName: string | null;
  autoDebit: boolean;
}

export interface AdjustmentLine {
  feeItemId: number;
  name: string;
  previousAmount: number;
  currentAmount: number;
  delta: number;
}

export interface UnitAdjustment {
  unitId: number;
  unitNo: string;
  dong: string | null;
  tenantName: string | null;
  autoDebit: boolean;
  previousTotal: number;
  currentTotal: number;
  totalDelta: number;
  lines: AdjustmentLine[];
}

function chargedItems(source: AdjustmentSource | undefined): Map<number, BillItem> {
  return new Map(
    (source?.items ?? [])
      .filter((item) => item.charged)
      .map((item) => [item.feeItemId, item]),
  );
}

/** Builds a stable per-unit, per-item current-vs-previous confirmed billing diff. */
export function buildAdjustmentRows(
  current: AdjustmentSource[],
  previous: AdjustmentSource[],
): UnitAdjustment[] {
  const currentByUnit = new Map(current.map((document) => [document.unitId, document]));
  const previousByUnit = new Map(previous.map((document) => [document.unitId, document]));
  const unitIds = [...new Set([...currentByUnit.keys(), ...previousByUnit.keys()])];

  return unitIds.map((unitId) => {
    const currentDocument = currentByUnit.get(unitId);
    const previousDocument = previousByUnit.get(unitId);
    const reference = currentDocument ?? previousDocument;
    if (!reference) throw new Error("adjustment document reference is missing");

    const currentItems = chargedItems(currentDocument);
    const previousItems = chargedItems(previousDocument);
    const itemIds = [...new Set([...currentItems.keys(), ...previousItems.keys()])];
    const lines = itemIds.map((feeItemId) => {
      const currentItem = currentItems.get(feeItemId);
      const previousItem = previousItems.get(feeItemId);
      const currentAmount = currentItem?.amount ?? 0;
      const previousAmount = previousItem?.amount ?? 0;
      return {
        feeItemId,
        name: currentItem?.name ?? previousItem?.name ?? "관리비 항목",
        previousAmount,
        currentAmount,
        delta: currentAmount - previousAmount,
      };
    });
    const currentTotal = currentDocument ? giroDocumentAmount(currentDocument) : 0;
    const previousTotal = previousDocument ? giroDocumentAmount(previousDocument) : 0;

    return {
      unitId,
      unitNo: reference.unitNo,
      dong: reference.dong,
      tenantName: reference.tenantName,
      autoDebit: currentDocument?.autoDebit ?? previousDocument?.autoDebit ?? false,
      previousTotal,
      currentTotal,
      totalDelta: currentTotal - previousTotal,
      lines,
    };
  }).sort((a, b) => a.unitNo.localeCompare(b.unitNo, "ko-KR", { numeric: true }));
}
