import type {
  CustomerNumberLookupKind,
  CustomerNumberLookupRow,
} from "@/hooks/reactquery/buildingCustomerNumbers";
import type { XlsxColumn } from "@/lib/export/xlsx";

const BILLING_BASIS_LABELS: Record<CustomerNumberLookupRow["billingBasis"], string> = {
  prev: "전월",
  current: "당월",
};

const CALCULATION_LABELS: Record<CustomerNumberLookupRow["calculationMethod"], string> = {
  auto: "자동",
  manual: "수동",
};

interface CustomerNumberWorkbookData {
  columns: XlsxColumn[];
  rows: Record<string, unknown>[];
}

export function buildCustomerNumberWorkbookData(
  rows: CustomerNumberLookupRow[],
  kind: CustomerNumberLookupKind,
): CustomerNumberWorkbookData {
  return {
    columns: [
      { header: "코드", key: "buildingCode", width: 12 },
      { header: "빌라명", key: "buildingName", width: 22 },
      { header: "주소", key: "address", width: 34 },
      { header: "LIN", key: "lineName", width: 10 },
      {
        header: kind === "water" ? "수도고객번호" : "공용전기고객번호",
        key: "customerNo",
        width: 24,
      },
      { header: "일금일", key: "meterDay", width: 10 },
      { header: "구분", key: "billingBasis", width: 10 },
      { header: "계산", key: "calculationMethod", width: 10 },
      { header: "기타적요", key: "note", width: 30 },
    ],
    rows: rows.map((row) => ({
      buildingCode: row.buildingCode,
      buildingName: row.buildingName,
      address: row.address ?? "",
      lineName: row.lineName ?? "",
      customerNo: row.customerNo,
      meterDay: row.meterDay ?? "",
      billingBasis: BILLING_BASIS_LABELS[row.billingBasis],
      calculationMethod: CALCULATION_LABELS[row.calculationMethod],
      note: row.note ?? "",
    })),
  };
}
