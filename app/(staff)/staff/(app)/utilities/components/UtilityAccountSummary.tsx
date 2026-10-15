import { Input } from "@/components/common";
import type { UtilityCustomerBillRow, UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { formatNumber } from "@/lib/format";
import { groupRowsByRegisteredCustomer } from "./customerNumberGroups";
import { GridEmptyValue } from "./GridEmptyValue";
import { UtilityGrid, type UtilityGridColumn } from "./UtilityGrid";

interface UtilityAccountSummaryProps {
  rows: UtilityUnitRow[];
  selectedRow: UtilityUnitRow | null;
  editing: boolean;
  onSelect: (row: UtilityUnitRow) => void;
  /** 고객번호×월 청구총액(0274). 등록된 고객번호만 부과액을 직접 입력할 수 있다. */
  customerBills?: UtilityCustomerBillRow[];
  /** 고객번호별 부과액 입력 초안(customerNo → 값). */
  chargeDrafts?: Record<string, string>;
  onChargeDraftChange?: (customerNo: string, value: string) => void;
}

const inputClass = "h-[26px] rounded-[7px] border border-teal bg-white px-[7px] text-[11.5px] font-bold text-t1 outline-none focus:ring-1 focus:ring-teal/20";
/** 값이 없는 셀 — 정본 `.dsh`(t3 / weight 500). */
const DASH = "num text-t3";

interface AccountRow {
  customerNumber: string;
  /** 연결된 호실이 없는 등록 고객번호면 null. */
  anchor: UtilityUnitRow | null;
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

/** 건물 부가정보에 등록된 고객번호(정렬순)별로 호실 지침을 합산한다. */
function groupByCustomer(rows: UtilityUnitRow[], registered: string[]): AccountRow[] {
  const groups = groupRowsByRegisteredCustomer(rows, registered);

  return [...groups.entries()].map(([customerNumber, group]) => {
    const anchor = group[0] ?? null;
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
      unitPrice: anchor ? anchor.unitPrice ?? anchor.resolvedUnitPrice : null,
    };
  });
}

export function UtilityAccountSummary({
  rows,
  selectedRow,
  editing,
  onSelect,
  customerBills,
  chargeDrafts,
  onChargeDraftChange,
}: UtilityAccountSummaryProps) {
  const accounts = groupByCustomer(rows, (customerBills ?? []).map((bill) => bill.customerNo));
  const billFor = (customerNumber: string) => customerBills?.find((bill) => bill.customerNo === customerNumber);
  /** 청구총액을 입력했으면 그 총액(호실은 서버가 배분), 아니면 기존 호실 합계. */
  const chargeOf = (row: AccountRow) => billFor(row.customerNumber)?.amount ?? (row.manual || row.charge);

  const columns: UtilityGridColumn<AccountRow>[] = [
    { key: "no", label: "L", minWidth: 34, align: "right", cellClassName: "num", render: (_row, index) => index + 1 },
    {
      key: "customerNumber",
      label: "고객번호",
      minWidth: 104,
      cellClassName: "font-bold",
      render: (row) => editing
        ? <Input unstyled aria-label={`${row.customerNumber} 고객번호`} value={row.customerNumber} readOnly className={`${inputClass} w-[92px]`} />
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
      render: (row) => {
        if (!editing) return formatNumber(chargeOf(row));
        const editable = Boolean(onChargeDraftChange && billFor(row.customerNumber));
        return (
          <Input
            unstyled
            aria-label={`${row.customerNumber} 부과액`}
            inputMode="numeric"
            value={chargeDrafts?.[row.customerNumber] ?? (chargeOf(row) || "")}
            readOnly={!editable}
            onChange={editable ? (event) => onChargeDraftChange?.(row.customerNumber, event.target.value) : undefined}
            className={`${inputClass} w-[64px] text-right`}
          />
        );
      },
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
          : "bg-white hover:bg-row-hover"}
        onRowClick={(row) => { if (row.anchor) onSelect(row.anchor); }}
        empty={<div className="grid h-[96px] place-items-center text-[13px] text-t3">등록된 고객번호가 없어요.</div>}
        className="h-full"
      />
    </section>
  );
}
