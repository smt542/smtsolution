import type { OverdueHousehold } from "@/hooks/reactquery/overdue";
import {
  formatDate as formatSharedDate,
  formatWon as formatSharedWon,
} from "@/lib/format";

export const DEBT_COLLECTION_MIN_MONTHS = 2;
export const DEBT_COLLECTION_MIN_AMOUNT = 100_000;

export function isDebtCollectionTarget(row: OverdueHousehold): boolean {
  return (
    row.overdueMonths >= DEBT_COLLECTION_MIN_MONTHS &&
    row.overdueAmount + (row.lateFeeAmount ?? 0) >= DEBT_COLLECTION_MIN_AMOUNT
  );
}

export function formatWon(amount: number): string {
  return formatSharedWon(amount);
}

export function formatDate(value?: string | null): string {
  return formatSharedDate(value);
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createOverdueLedgerCsv(rows: OverdueHousehold[]): string {
  const headers = [
    "건물명",
    "호실명",
    "입주자명",
    "연락처",
    "연체 개월수",
    "미납금액",
    "연체료",
    "최근 납부일",
    "데이터 상태",
  ];
  const body = rows.map((row) => [
    row.buildingName,
    [row.dong, row.unitNo].filter(Boolean).join(" "),
    row.tenantName ?? "",
    row.phone ?? "",
    row.overdueMonths,
    row.overdueAmount,
    row.lateFeeAmount ?? 0,
    row.lastPaymentDate ?? "",
    row.billingAvailable ? "확정 부과 있음" : "확정 부과 없음",
  ]);

  return [headers, ...body].map((line) => line.map(csvCell).join(",")).join("\r\n");
}

export function overdueLedgerFilename(buildingName: string, now = new Date()): string {
  const safeBuildingName = buildingName.replace(/[\\/:*?"<>|]/g, "_");
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  return `${safeBuildingName}_미납대장_${yearMonth}.csv`;
}

export function downloadOverdueLedger(
  buildingName: string,
  rows: OverdueHousehold[],
  now = new Date(),
): string {
  // TODO(export): 서버사이드 원장/PDF 규격 확정 후 공용 출력 API로 교체한다.
  const blob = new Blob(["\uFEFF", createOverdueLedgerCsv(rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const filename = overdueLedgerFilename(buildingName, now);
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return filename;
}

