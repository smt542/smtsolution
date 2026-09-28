import type { Deposit } from "./bankParse";
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

export interface DepositPreviewRow {
  deposit: Deposit;
  unit: DepositPreviewUnit | null;
  error: DepositPreviewError;
  dueStatus: "" | "납기전" | "납기후";
}

function comparableDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  return match
    ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`
    : value.slice(0, 10);
}

function paymentKey(unitId: number, amount: number, paidAt: string | null): string | null {
  const date = comparableDate(paidAt);
  return date ? `${unitId}:${amount}:${date}` : null;
}

function dueStatus(deposit: Deposit, unit: DepositPreviewUnit): DepositPreviewRow["dueStatus"] {
  const paidAt = comparableDate(deposit.paidAt);
  const dueDate = comparableDate(unit.dueDate);
  if (!paidAt || !dueDate) return "";
  return paidAt > dueDate ? "납기후" : "납기전";
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
  const existingKeys = new Set(
    existingPayments
      .map((payment) => paymentKey(payment.unitId, payment.amount, payment.paidAt))
      .filter((key): key is string => key !== null),
  );
  const fileKeys = new Set<string>();
  // 같은 세대에 입금이 여러 건이면 앞 행이 정상으로 받은 금액만큼 남은 미납을 줄여 가며 초과를 본다
  // (건마다 전체 미납과만 비교하면 합쳐서 미납을 넘어도 모두 정상이 된다).
  const remainingUnpaid = new Map<number, number>();

  return deposits.map((deposit) => {
    if (deposit.amount <= 0) {
      return { deposit, unit: null, error: "금액 없음", dueStatus: "" };
    }

    const matched = matchedByRow.get(deposit.rowIndex);
    if (!matched) {
      return {
        deposit,
        unit: null,
        error: ambiguousRows.has(deposit.rowIndex) ? "세대 중복" : "세대 없음",
        dueStatus: "",
      };
    }

    const unit = unitById.get(matched.unitId) ?? null;
    if (!unit) {
      return { deposit, unit: null, error: "세대 없음", dueStatus: "" };
    }

    const key = paymentKey(unit.unitId, deposit.amount, deposit.paidAt);
    const duplicate = key !== null && (existingKeys.has(key) || fileKeys.has(key));
    if (key !== null) fileKeys.add(key);
    if (duplicate) {
      return { deposit, unit, error: "이중수납", dueStatus: dueStatus(deposit, unit) };
    }
    if (unit.unpaid !== null) {
      const remaining = remainingUnpaid.get(unit.unitId) ?? unit.unpaid;
      if (deposit.amount > remaining) {
        return { deposit, unit, error: "초과입금", dueStatus: dueStatus(deposit, unit) };
      }
      remainingUnpaid.set(unit.unitId, remaining - deposit.amount);
    }
    return { deposit, unit, error: "정상", dueStatus: dueStatus(deposit, unit) };
  });
}

