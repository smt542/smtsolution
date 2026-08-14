import type {
  CustomerNumberKind,
  CustomerNumberLookupRow,
} from "@/hooks/reactquery/buildingCustomerNumbers";
import type { XlsxColumn } from "@/lib/export/xlsx";

const KIND_LABELS: Record<CustomerNumberKind, string> = {
  water: "수도",
  common_elec: "공용전기",
  elec: "전기",
  gas: "가스",
};

const BILLING_BASIS_LABELS: Record<CustomerNumberLookupRow["billingBasis"], string> = {
  prev: "전월",
  current: "당월",
};

interface CustomerNumberWorkbookData {
  columns: XlsxColumn[];
  rows: Record<string, unknown>[];
}

export function buildCustomerNumberWorkbookData(
  rows: CustomerNumberLookupRow[],
): CustomerNumberWorkbookData {
  return {
    columns: [
      { header: "건물명", key: "buildingName", width: 24 },
      { header: "유형", key: "kind", width: 12 },
      { header: "고객번호", key: "customerNo", width: 22 },
      { header: "명의자", key: "holderName", width: 16 },
      { header: "검침일", key: "meterDay", width: 10 },
      { header: "부과기준", key: "billingBasis", width: 12 },
      { header: "고지서출력", key: "printOnBill", width: 12 },
    ],
    rows: rows.map((row) => ({
      buildingName: row.buildingName,
      kind: KIND_LABELS[row.kind],
      customerNo: row.customerNo,
      holderName: row.holderName ?? "",
      meterDay: row.meterDay ?? "",
      billingBasis: BILLING_BASIS_LABELS[row.billingBasis],
      printOnBill: row.printOnBill ? "Y" : "N",
    })),
  };
}
