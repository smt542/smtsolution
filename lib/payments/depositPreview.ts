import type { Deposit } from "./bankParse";
import type { GiroRecord } from "./giroFile";
import { matchDeposits, type MatchUnit } from "./match";

export type DepositPreviewError =
  | "정상"
  | "금액 없음"
  | "세대 없음"
  | "세대 중복"
  | "이중수납"
  | "초과입금";

export interface DepositPreviewUnit extends MatchUnit {
  buildingCode: string | null;
  buildingName: string | null;
  dong: string | null;
  dueDate: string | null;
}

export interface ExistingDepositPayment {
  unitId: number;
  amount: number;
  paidAt: string;
}

export interface ExistingGiroPayment {
  unitId: number;
  period: string;
  amount: number;
  paidAt: string;
}

export interface DepositPreviewRow {
  deposit: Deposit;
  unit: DepositPreviewUnit | null;
  error: DepositPreviewError;
  dueStatus: "" | "납기전" | "납기후";
}

export interface GiroPreviewRow {
  record: GiroRecord;
  unit: DepositPreviewUnit | null;
  error: DepositPreviewError;
  dueStatus: "" | "납기전" | "납기후";
  duplicatePaidAt: string | null;
}

type PreviewRecord = {
  rowIndex: number;
  amount: number;
  paidAt: string | null;
  period?: string;
  externalRef?: string;
};

type PreviewExistingPayment = {
  unitId: number;
  amount: number;
  paidAt: string;
  period?: string;
};

interface MatchDecision {
  unit: DepositPreviewUnit | null;
  ambiguous: boolean;
}

interface JudgedPreviewRow<T extends PreviewRecord> {
  record: T;
  unit: DepositPreviewUnit | null;
  error: DepositPreviewError;
  dueStatus: "" | "납기전" | "납기후";
  duplicatePaidAt: string | null;
}

function comparableDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  return match
    ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`
    : value.slice(0, 10);
}

function paymentKey(
  unitId: number,
  amount: number,
  paidAt: string | null,
  period: string | undefined,
): string | null {
  const date = comparableDate(paidAt);
  return date ? `${unitId}:${period ?? ""}:${amount}:${date}` : null;
}

function dueStatus(
  paidAtValue: string | null,
  unit: DepositPreviewUnit,
): "" | "납기전" | "납기후" {
  const paidAt = comparableDate(paidAtValue);
  const dueDate = comparableDate(unit.dueDate);
  if (!paidAt || !dueDate) return "";
  return paidAt > dueDate ? "납기후" : "납기전";
}

function judgePreviewRows<T extends PreviewRecord>(
  records: T[],
  findMatch: (record: T) => MatchDecision,
  existingPayments: PreviewExistingPayment[],
): JudgedPreviewRow<T>[] {
  const existingPaidDates = new Map<string, string>();
  for (const payment of existingPayments) {
    const key = paymentKey(payment.unitId, payment.amount, payment.paidAt, payment.period);
    if (key && !existingPaidDates.has(key)) existingPaidDates.set(key, payment.paidAt);
  }
  const fileKeys = new Set<string>();
  const fileExternalRefs = new Set<string>();
  // 같은 세대에 입금이 여러 건이면 앞 행이 정상으로 받은 금액만큼 남은 미납을 줄여 가며 초과를 본다
  // (건마다 전체 미납과만 비교하면 합쳐서 미납을 넘어도 모두 정상이 된다). 지로는 부과월마다 따로 줄인다.
  const remainingUnpaid = new Map<string, number>();

  return records.map((record) => {
    if (record.amount <= 0) {
      return { record, unit: null, error: "금액 없음", dueStatus: "", duplicatePaidAt: null };
    }

    const match = findMatch(record);
    if (!match.unit) {
      return {
        record,
        unit: null,
        error: match.ambiguous ? "세대 중복" : "세대 없음",
        dueStatus: "",
        duplicatePaidAt: null,
      };
    }

    const unit = match.unit;

    const key = paymentKey(unit.unitId, record.amount, record.paidAt, record.period);
    const externalRef = record.externalRef;
    const duplicate = Boolean(
      (key && (existingPaidDates.has(key) || fileKeys.has(key)))
      || (externalRef && fileExternalRefs.has(externalRef)),
    );
    if (key) fileKeys.add(key);
    if (externalRef) fileExternalRefs.add(externalRef);
    if (duplicate) {
      return {
        record,
        unit,
        error: "이중수납",
        dueStatus: dueStatus(record.paidAt, unit),
        duplicatePaidAt: key ? existingPaidDates.get(key) ?? null : null,
      };
    }

    const remainingKey = `${unit.unitId}:${record.period ?? ""}`;
    if (unit.unpaid !== null) {
      const remaining = remainingUnpaid.get(remainingKey) ?? unit.unpaid;
      if (record.amount > remaining) {
        return {
          record,
          unit,
          error: "초과입금",
          dueStatus: dueStatus(record.paidAt, unit),
          duplicatePaidAt: null,
        };
      }
      remainingUnpaid.set(remainingKey, remaining - record.amount);
    }
    return {
      record,
      unit,
      error: "정상",
      dueStatus: dueStatus(record.paidAt, unit),
      duplicatePaidAt: null,
    };
  });
}

/** 은행·지로 업로드 미리보기의 공통 행 판정. 렌더링과 반영 양쪽에서 같은 결과를 사용한다. */
export function buildDepositPreview(
  deposits: Deposit[],
  units: DepositPreviewUnit[],
  existingPayments: ExistingDepositPayment[],
): DepositPreviewRow[] {
  const matchUnits: MatchUnit[] = units.map((unit) => unit);
  const matches = matchDeposits(deposits, matchUnits);
  const matchedByRow = new Map(matches.matched.map((item) => [item.deposit.rowIndex, item]));
  const ambiguousRows = new Set(matches.ambiguous.map((item) => item.deposit.rowIndex));
  const unitById = new Map(units.map((unit) => [unit.unitId, unit]));
  const judged = judgePreviewRows(
    deposits,
    (deposit) => {
      const matched = matchedByRow.get(deposit.rowIndex);
      return {
        unit: matched ? unitById.get(matched.unitId) ?? null : null,
        ambiguous: ambiguousRows.has(deposit.rowIndex),
      };
    },
    existingPayments,
  );
  return judged.map(({ record, unit, error, dueStatus }) => ({
    deposit: record,
    unit,
    error,
    dueStatus,
  }));
}

export function normCode(value: string | null | undefined): number | null {
  const normalized = value?.trim() ?? "";
  return /^\d+$/.test(normalized) ? Number(normalized) : null;
}

export function normRoom(value: string | null | undefined): number | null {
  const normalized = (value?.trim() ?? "").replace(/호\s*$/, "").trim();
  return /^\d+$/.test(normalized) ? Number(normalized) : null;
}

function giroMatch(
  record: GiroRecord,
  unitsByPeriod: ReadonlyMap<string, DepositPreviewUnit[]>,
): MatchDecision {
  const code = Number(record.buildingCode);
  const room = Number(record.roomNo);
  const candidates = new Map<number, DepositPreviewUnit>();
  for (const unit of unitsByPeriod.get(record.period) ?? []) {
    if (normCode(unit.buildingCode) === code && normRoom(unit.unitNo) === room) {
      candidates.set(unit.unitId, unit);
    }
  }
  if (candidates.size !== 1) return { unit: null, ambiguous: candidates.size > 1 };
  return { unit: candidates.values().next().value ?? null, ambiguous: false };
}

export function buildGiroPreview(
  records: GiroRecord[],
  unitsByPeriod: ReadonlyMap<string, DepositPreviewUnit[]>,
  existingPayments: ExistingGiroPayment[],
): GiroPreviewRow[] {
  const judged = judgePreviewRows(
    records,
    (record) => giroMatch(record, unitsByPeriod),
    existingPayments,
  );
  return judged.map(({ record, unit, error, dueStatus, duplicatePaidAt }) => ({
    record,
    unit,
    error,
    dueStatus,
    duplicatePaidAt,
  }));
}
