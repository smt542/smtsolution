import { Input } from "@/components/common";
import type { GasTableRow, GasUtilityDraft } from "./types";
import { GridEmptyValue } from "../GridEmptyValue";
import { UtilityGrid, type UtilityGridColumn } from "../UtilityGrid";
import { usageFromReadings } from "../UtilityLock";

interface GasAccountSummaryProps {
  rows: GasTableRow[];
  drafts: Record<number, GasUtilityDraft>;
  editing: boolean;
}

interface GasAccountLine {
  customerNumber: string;
  usage: number;
  manualCharge: number | null;
  discountAmount: number;
  charge: number;
  unitPrice: number | null;
  currentReading: number;
  previousReading: number;
}

const SUMMARY_TABLE_WIDTH = 1294;

function numeric(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function display(value: number | null, suffix = ""): string {
  return value === null ? "-" : `${value.toLocaleString("ko-KR", { maximumFractionDigits: 3 })}${suffix}`;
}

function summarize(rows: GasTableRow[], drafts: Record<number, GasUtilityDraft>): GasAccountLine[] {
  const groups = new Map<string, GasTableRow[]>();
  rows.forEach((row) => {
    const key = row.customerNumber ?? "미지정";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  return Array.from(groups, ([customerNumber, groupRows]) => groupRows.reduce<GasAccountLine>(
    (line, row) => {
      const draft = drafts[row.unitId];
      const current = numeric(draft?.currentReading ?? "") ?? row.currentReading ?? row.previousReading ?? 0;
      const previous = numeric(draft?.previousReading ?? "") ?? row.previousReading ?? 0;
      const calculated = usageFromReadings(
        draft?.previousReading ?? "",
        draft?.currentReading ?? "",
        true,
      );
      const usage = draft?.usageLocked
        ? numeric(draft.lockedUsage) ?? 0
        : draft?.usageEdited
          ? numeric(draft.usage) ?? 0
          : calculated ?? 0;
      const manual = numeric(draft?.manualCharge ?? "");
      line.usage += usage;
      line.currentReading += current;
      line.previousReading += previous;
      line.discountAmount += row.discountAmount ?? 0;
      line.charge += manual ?? row.automaticCharge ?? usage * (row.resolvedUnitPrice ?? 0);
      if (manual !== null) line.manualCharge = (line.manualCharge ?? 0) + manual;
      if (line.unitPrice === null) line.unitPrice = row.resolvedUnitPrice;
      return line;
    },
    {
      customerNumber,
      usage: 0,
      manualCharge: null,
      discountAmount: 0,
      charge: 0,
      unitPrice: null,
      currentReading: 0,
      previousReading: 0,
    },
  ));
}

export function GasAccountSummary({ rows, drafts, editing }: GasAccountSummaryProps) {
  const lines = summarize(rows, drafts);
  const columns: UtilityGridColumn<GasAccountLine>[] = [
    {
      key: "line",
      label: "L",
      width: 43,
      align: "right",
      cellClassName: "tabular-nums",
      render: (_line, index) => index + 1,
    },
    {
      key: "customerNumber",
      label: "고객번호",
      width: 224,
      align: "left",
      cellClassName: "font-bold",
      render: (line) => editing ? (
        <Input
          unstyled
          aria-label={`${line.customerNumber} 고객번호`}
          readOnly
          value={line.customerNumber}
          className="h-[26px] w-full rounded-[7px] border border-teal bg-white px-2 text-[11.5px] font-semibold text-t2 outline-none"
        />
      ) : line.customerNumber,
    },
    {
      key: "month",
      label: "월",
      width: 59,
      align: "left",
      cellClassName: "",
      render: () => "당월",
    },
    {
      key: "usage",
      label: "량",
      width: 61,
      align: "right",
      cellClassName: "tabular-nums",
      render: (line) => display(line.usage),
    },
    {
      key: "manualCharge",
      label: "수동입력",
      width: 78,
      align: "right",
      cellClassName: "tabular-nums",
      render: (line) => line.manualCharge === null ? <GridEmptyValue /> : display(line.manualCharge),
    },
    {
      key: "discountAmount",
      label: "할인금액",
      width: 90,
      align: "right",
      cellClassName: "tabular-nums text-red",
      render: (line) => line.discountAmount ? `-${display(line.discountAmount)}` : "-",
    },
    {
      key: "previousCharge",
      label: "전월금액",
      width: 83,
      align: "right",
      cellClassName: "text-t3",
      render: () => "-",
    },
    {
      key: "charge",
      label: "부과액",
      width: 224,
      align: "right",
      cellClassName: "tabular-nums",
      render: (line) => editing ? (
        <Input
          unstyled
          aria-label={`${line.customerNumber} 부과액`}
          readOnly
          value={line.charge.toLocaleString("ko-KR")}
          className="h-[26px] w-full rounded-[7px] border border-teal bg-white px-2 text-right text-[11.5px] font-semibold tabular-nums text-t2 outline-none"
        />
      ) : display(line.charge),
    },
    {
      key: "previousUnitPrice",
      label: "전단가",
      width: 74,
      align: "right",
      cellClassName: "text-t3",
      render: () => "-",
    },
    {
      key: "unitPrice",
      label: "단가",
      width: 75,
      align: "right",
      cellClassName: "tabular-nums",
      render: (line) => line.unitPrice === null ? <GridEmptyValue /> : display(line.unitPrice),
    },
    {
      key: "difference1",
      label: "금-전1",
      width: 83,
      align: "right",
      cellClassName: "text-t3",
      render: () => "-",
    },
    {
      key: "difference2",
      label: "금-전2",
      width: 69,
      align: "right",
      cellClassName: "text-t3",
      render: () => "-",
    },
    {
      key: "currentReading",
      label: "금월량",
      width: 67,
      align: "right",
      cellClassName: "tabular-nums",
      render: (line) => display(line.currentReading),
    },
    {
      key: "previousReading",
      label: "전월량",
      width: 67,
      align: "right",
      cellClassName: "tabular-nums",
      render: (line) => display(line.previousReading),
    },
  ];

  return (
    <section aria-label="가스 고객번호 요약" className="h-[150px] shrink-0 overflow-x-auto rounded-2xl bg-white shadow-card">
      <UtilityGrid
        columns={columns}
        rows={lines}
        rowKey={(line) => line.customerNumber}
        ariaLabel="가스 고객번호 요약"
        editing={editing}
        layout="fixed"
        tableWidth={SUMMARY_TABLE_WIDTH}
        rowClassName="bg-white hover:bg-row-hover"
        empty={<p className="flex h-[51px] w-[1294px] items-center justify-center text-[13px] text-t3">등록된 고객번호가 없어요.</p>}
        className="h-full"
      />
    </section>
  );
}
