import type { UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { formatNumber } from "@/lib/format";
import { GridEmptyValue } from "./GridEmptyValue";
import { UtilityGrid, type UtilityGridColumn } from "./UtilityGrid";

interface UtilityAccountSummaryProps {
  rows: UtilityUnitRow[];
  selectedRow: UtilityUnitRow | null;
  editing: boolean;
  onSelect: (row: UtilityUnitRow) => void;
}

const inputClass = "h-[26px] rounded-[7px] border border-teal bg-white px-[7px] text-[11.5px] font-bold text-t1 outline-none focus:ring-1 focus:ring-teal/20";
/** 값이 없는 셀 — 정본 `.dsh`(t3 / weight 500). */
const DASH = "num text-t3";

interface AccountRow {
  customerNumber: string;
  anchor: UtilityUnitRow;
  unitIds: number[];
  charge: number;
  manual: number;
  discount: number;
  usage: number;
  previousUsage: number;
  manualText: string;
  unitPrice: number | null;
}

function sum(rows: UtilityUnitRow[], key: keyof UtilityUnitRow): number {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function display(value: number, hasValue = true): string {
  return hasValue && value !== 0 ? formatNumber(value) : "-";
}

function groupByCustomer(rows: UtilityUnitRow[]): AccountRow[] {
  const groups = new Map<string, UtilityUnitRow[]>();
  rows.forEach((row) => {
    const key = row.customerNumber ?? "미등록";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  return [...groups.entries()].map(([customerNumber, group]) => {
    const anchor = group[0];
    const manual = sum(group, "manualCharge");
    return {
      customerNumber,
      anchor,
      unitIds: group.map((row) => row.unitId),
      charge: sum(group, "automaticCharge"),
      manual,
      discount: sum(group, "discountAmount"),
      usage: sum(group, "usage"),
      previousUsage: sum(group, "previousUsage"),
      manualText: display(manual, group.some((row) => row.manualCharge !== null)),
      unitPrice: anchor.unitPrice ?? anchor.resolvedUnitPrice,
    };
  });
}

export function UtilityAccountSummary({
  rows,
  selectedRow,
  editing,
  onSelect,
}: UtilityAccountSummaryProps) {
  const accounts = groupByCustomer(rows);

  const columns: UtilityGridColumn<AccountRow>[] = [
    { key: "no", label: "L", minWidth: 34, align: "right", cellClassName: "num", render: (_row, index) => index + 1 },
    {
      key: "customerNumber",
      label: "고객번호",
      minWidth: 104,
      cellClassName: "font-bold",
      render: (row) => editing
        ? <input aria-label={`${row.customerNumber} 고객번호`} value={row.customerNumber} readOnly className={`${inputClass} w-[92px]`} />
        : row.customerNumber,
    },
    { key: "month", label: "월", minWidth: 48, render: () => "당월" },
    { key: "usage", label: "량", minWidth: 48, align: "right", cellClassName: "num", render: (row) => formatNumber(row.usage) },
    {
      key: "manual",
      label: "수동입력",
      minWidth: 70,
      align: "right",
      cellClassName: (row) => row.manualText === "-" ? DASH : "num",
      render: (row) => row.manualText,
    },
    {
      key: "discount",
      label: "할인금액",
      minWidth: 74,
      align: "right",
      cellClassName: (row) => row.discount ? "num font-semibold text-red" : DASH,
      render: (row) => row.discount ? `-${formatNumber(row.discount)}` : "-",
    },
    { key: "previousCharge", label: "전월금액", minWidth: 76, align: "right", cellClassName: DASH, render: () => "-" },
    {
      key: "charge",
      label: "부과액",
      minWidth: 76,
      align: "right",
      cellClassName: "num font-bold",
      render: (row) => editing
        ? <input aria-label={`${row.customerNumber} 부과액`} value={row.manual || row.charge || ""} readOnly className={`${inputClass} w-[64px] text-right`} />
        : formatNumber(row.manual || row.charge),
    },
    { key: "previousUnitPrice", label: "전단가", minWidth: 62, align: "right", cellClassName: DASH, render: () => "-" },
    {
      key: "unitPrice",
      label: "단가",
      minWidth: 58,
      align: "right",
      cellClassName: (row) => row.unitPrice ? "num font-semibold" : DASH,
      render: (row) => row.unitPrice ? formatNumber(row.unitPrice) : <GridEmptyValue />,
    },
    { key: "diff1", label: "금-전1", minWidth: 66, align: "right", cellClassName: DASH, render: () => "-" },
    { key: "diff2", label: "금-전2", minWidth: 62, align: "right", cellClassName: DASH, render: () => "-" },
    { key: "currentUsage", label: "금월량", minWidth: 62, align: "right", cellClassName: "num", render: (row) => formatNumber(row.usage) },
    { key: "previousUsage", label: "전월량", minWidth: 62, align: "right", cellClassName: "num", render: (row) => formatNumber(row.previousUsage) },
  ];

  return (
    <section className="h-[150px] shrink-0 overflow-hidden rounded-[16px] bg-white shadow-card">
      <UtilityGrid
        columns={columns}
        rows={accounts}
        rowKey={(row) => row.customerNumber}
        ariaLabel="수도 고객번호 요약"
        editing={editing}
        rowClassName={(row) => selectedRow && row.unitIds.includes(selectedRow.unitId)
          ? "bg-blue-t"
          : "bg-white hover:bg-blue-t2"}
        onRowClick={(row) => onSelect(row.anchor)}
        empty={<div className="grid h-[96px] place-items-center text-[13px] text-t3">등록된 고객번호가 없어요.</div>}
        className="h-full"
      />
    </section>
  );
}
