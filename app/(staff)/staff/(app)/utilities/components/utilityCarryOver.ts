import type { CarryUtilityPeriodSummary, UtilityCustomerBillRow, UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { groupRowsByRegisteredCustomer } from "./customerNumberGroups";

/** 전체 이월 결과 안내문(이월·유지·건너뜀·실패 건수). */
export function carryOverMessage(label: string, summary: CarryUtilityPeriodSummary): string {
  const parts = [`${summary.carried}개 건물 부과기준일 이월`];
  if (summary.kept > 0) parts.push(`${summary.kept}개는 이미 설정돼 유지`);
  if (summary.skipped > 0) parts.push(`${summary.skipped}개는 기준일이 없거나 올바르지 않아 건너뜀`);
  if (summary.failedCount > 0) parts.push(`${summary.failedCount}개 실패`);
  return `${label}: ${parts.join(", ")}`;
}

export interface PreviousAccountValues {
  /** 전월 부과액(수동입력 우선, 없으면 자동). 전월 행이 없으면 null. */
  charge: number | null;
  /** 전월 단가. 전월 행에 저장된 단가가 없으면 null. */
  unitPrice: number | null;
}

/** 고객번호별 전월 부과액·단가: 전월 청구총액·호실 행을 조회해 계산한다(익월에 복사 저장하지 않음). */
export function previousValuesByCustomer(
  previousRows: UtilityUnitRow[],
  registered: string[],
  previousBills: UtilityCustomerBillRow[] = [],
): Map<string, PreviousAccountValues> {
  const result = new Map<string, PreviousAccountValues>();
  groupRowsByRegisteredCustomer(previousRows, registered).forEach((group, customerNumber) => {
    const charged = group.filter((row) => row.manualCharge !== null || row.automaticCharge !== null);
    result.set(customerNumber, {
      // 당월 부과액 열(chargeOf)과 같이 전월 고객번호 청구총액을 우선하고, 없으면 호실 합계.
      charge: previousBills.find((bill) => bill.customerNo === customerNumber)?.amount
        ?? (charged.length > 0
          ? charged.reduce((sum, row) => sum + (row.manualCharge ?? row.automaticCharge ?? 0), 0)
          : null),
      unitPrice: group.find((row) => row.unitPrice !== null)?.unitPrice ?? null,
    });
  });
  return result;
}
