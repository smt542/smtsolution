import { Input } from "@/components/common";
import { formatNumber } from "@/lib/format";
import { GridEmptyValue } from "./GridEmptyValue";
import { UtilityGrid, type UtilityGridColumn } from "./UtilityGrid";

export interface ElectricityCustomerSummaryRow {
  id: number;
  customerNumber: string;
  billedAmount: number;
  chargeAmount: number;
  usage: number;
  unitPrice: number | null;
  currentReading: number;
  previousReading: number;
  meterDifference: number;
  movingCharge: number;
}

export interface ElectricityCustomerSummaryDraft {
  customerNumber: string;
  chargeAmount: string;
  /** 부과액(고객번호×월 청구총액)을 직접 고쳤는지. 고친 값만 청구총액으로 저장한다(옵트인). */
  chargeAmountEdited?: boolean;
}

interface ElectricityCustomerSummaryProps {
  rows: ElectricityCustomerSummaryRow[];
  drafts: Record<number, ElectricityCustomerSummaryDraft>;
  editing: boolean;
  onDraftChange: (id: number, patch: Partial<ElectricityCustomerSummaryDraft>) => void;
}

interface ElectricityCustomerSummaryGridRow extends ElectricityCustomerSummaryRow {
  draft: ElectricityCustomerSummaryDraft;
}

export function ElectricityCustomerSummary({
  rows,
  drafts,
  editing,
  onDraftChange,
}: ElectricityCustomerSummaryProps) {
  const preparedRows: ElectricityCustomerSummaryGridRow[] = rows.map((row) => ({
    ...row,
    draft: drafts[row.id] ?? {
      customerNumber: row.customerNumber,
      chargeAmount: String(row.chargeAmount),
    },
  }));

  const columns: UtilityGridColumn<ElectricityCustomerSummaryGridRow>[] = [
    {
      key: "line",
      label: "L",
      width: editing ? 58 : 77,
      align: "right",
      cellClassName: "font-medium text-t1",
      render: (_row, index) => index + 1,
    },
    {
      key: "customerNumber",
      label: "고객번호",
      width: editing ? 300 : 230,
      align: "left",
      cellClassName: "truncate font-bold text-t1",
      render: (row, index) => editing ? (
        <Input
          unstyled
          aria-label={`${index + 1}번 고객번호`}
          value={row.draft.customerNumber}
          onChange={(event) => onDraftChange(row.id, { customerNumber: event.target.value })}
          className="h-[26px] w-full rounded-[7px] border border-teal bg-white px-[7px] text-[11.5px] font-bold text-t1 outline-none"
        />
      ) : row.customerNumber,
    },
    {
      key: "billedAmount",
      label: "고지금액",
      width: 136,
      align: "right",
      cellClassName: "num",
      render: (row) => formatNumber(row.billedAmount),
    },
    {
      key: "chargeAmount",
      label: "부과액",
      width: editing ? 300 : 136,
      align: "right",
      cellClassName: "num font-bold text-t1",
      render: (row) => editing ? (
        <Input
          unstyled
          aria-label={`${row.customerNumber} 부과액`}
          type="number"
          value={row.draft.chargeAmount}
          onChange={(event) => onDraftChange(row.id, { chargeAmount: event.target.value })}
          className="num h-[26px] w-full rounded-[7px] border border-teal bg-white px-[7px] text-right text-[11.5px] font-bold text-t1 outline-none"
        />
      ) : formatNumber(row.chargeAmount),
    },
    {
      key: "usage",
      label: "량",
      width: editing ? 82 : 110,
      align: "right",
      cellClassName: "num",
      render: (row) => formatNumber(row.usage),
    },
    {
      key: "unitPrice",
      label: "단가",
      width: editing ? 87 : 116,
      align: "right",
      cellClassName: "num",
      render: (row) => row.unitPrice === null ? <GridEmptyValue /> : formatNumber(row.unitPrice, { fractionDigits: 1 }),
    },
    {
      key: "currentReading",
      label: "금월량",
      width: editing ? 90 : 120,
      align: "right",
      cellClassName: "num",
      render: (row) => formatNumber(row.currentReading),
    },
    {
      key: "previousReading",
      label: "전월량",
      width: editing ? 90 : 120,
      align: "right",
      cellClassName: "num",
      render: (row) => formatNumber(row.previousReading),
    },
    {
      key: "meterDifference",
      label: "감면",
      width: editing ? 107 : 144,
      align: "right",
      cellClassName: (row) => `num font-semibold ${row.meterDifference < 0 ? "text-red" : ""}`,
      render: (row) => formatNumber(row.meterDifference),
    },
    {
      key: "movingCharge",
      label: "이사",
      width: editing ? 75 : 101,
      align: "right",
      cellClassName: "num",
      render: (row) => row.movingCharge ? formatNumber(row.movingCharge) : <GridEmptyValue />,
    },
  ];

  return (
    <section className="h-[150px] flex-none overflow-hidden rounded-card bg-white shadow-card">
      <UtilityGrid
        columns={columns}
        rows={preparedRows}
        rowKey={(row) => row.id}
        ariaLabel="전기 고객번호 요약"
        editing={editing}
        layout="fixed"
        tableWidth={1294}
        rowClassName={(_row, index) => !editing && index === 0 ? "bg-blue-t" : "bg-white hover:bg-row-hover"}
        empty={(
          <div className="flex h-full flex-col items-center justify-center gap-[5px] px-6 pb-10 pt-[34px] text-center">
            <p className="text-[15px] font-semibold tracking-[-0.02em] text-t1">건물을 선택해 주세요</p>
            <p className="text-[13px] font-normal leading-[1.55] text-t3">선택한 건물의 고객번호가 여기에 표시돼요</p>
          </div>
        )}
        className="h-full"
      />
    </section>
  );
}
