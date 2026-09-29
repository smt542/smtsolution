import Image from "next/image";
import type { UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { formatNumber } from "@/lib/format";
import { GridEmptyValue } from "./GridEmptyValue";
import { UtilityGrid, type UtilityGridColumn } from "./UtilityGrid";

export interface ElectricityDraft {
  currentReading: string;
  manualCharge: string;
  note: string;
}

interface ElectricityReadingsTableProps {
  rows: UtilityUnitRow[];
  drafts: Record<number, ElectricityDraft>;
  referenceDate: string;
  utilityLabel?: string;
  editing: boolean;
  onDraftChange: (unitId: number, patch: Partial<ElectricityDraft>) => void;
}

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isNewOccupancy(moveInDate: string | null, referenceDate: string): boolean {
  if (!moveInDate || !referenceDate) return false;
  const moveIn = Date.parse(`${moveInDate}T00:00:00`);
  const reference = Date.parse(`${referenceDate}T00:00:00`);
  return !Number.isNaN(moveIn) && !Number.isNaN(reference)
    && Math.abs(reference - moveIn) <= 31 * 24 * 60 * 60 * 1000;
}

function inputClass(): string {
  return "num h-[26px] rounded-[7px] border border-teal bg-white px-[7px] text-right text-[11.5px] font-semibold text-t1 outline-none placeholder:font-medium placeholder:text-t3";
}

interface ElectricityReadingsGridRow {
  row: UtilityUnitRow;
  draft: ElectricityDraft;
  current: number | null;
  usage: number | null;
  invalidUsage: boolean;
  vacant: boolean;
  moving: boolean;
  recent: boolean;
  charge: number | null;
  marker: string;
}

export function ElectricityReadingsTable({
  rows,
  drafts,
  referenceDate,
  utilityLabel = "전기",
  editing,
  onDraftChange,
}: ElectricityReadingsTableProps) {
  const preparedRows: ElectricityReadingsGridRow[] = rows.map((row) => {
    const draft = drafts[row.unitId] ?? { currentReading: "", manualCharge: "", note: "" };
    const current = optionalNumber(draft.currentReading) ?? row.currentReading;
    const usage = current !== null && row.previousReading !== null
      ? current - row.previousReading
      : row.usage;
    const invalidUsage = row.needsReview || (
      current !== null
      && row.previousReading !== null
      && current - row.previousReading < 0
    );
    const vacant = row.occupancyStatus === "vacant" || row.occupancyId === null;
    const moving = row.occupancyStatus === "moving_out";
    const recent = !vacant && isNewOccupancy(row.moveInDate, referenceDate);
    const charge = optionalNumber(draft.manualCharge) ?? row.manualCharge ?? row.automaticCharge;
    const marker = moving
      ? "shadow-[inset_3px_0_0_#3182F6]"
      : vacant && (usage ?? 0) > 0
        ? "shadow-[inset_3px_0_0_#F04452]"
        : recent
          ? "shadow-[inset_3px_0_0_#12B886]"
          : "";

    return { row, draft, current, usage, invalidUsage, vacant, moving, recent, charge, marker };
  });

  const columns: UtilityGridColumn<ElectricityReadingsGridRow>[] = [
    {
      key: "unitNo",
      label: "호수",
      width: 59,
      align: "left",
      cellClassName: (item) => `${item.marker} font-bold text-t1`,
      render: (item) => item.row.unitNo.replace(/호$/, ""),
    },
    {
      key: "moveInDate",
      label: "입주일자",
      width: 115,
      align: "left",
      cellClassName: (item) => item.row.moveInDate && item.recent ? "font-semibold text-green" : "",
      render: (item) => item.row.moveInDate ?? <GridEmptyValue />,
    },
    {
      key: "moveOutDate",
      label: "퇴실일자",
      width: 112,
      align: "left",
      cellClassName: "",
      render: () => <GridEmptyValue />,
    },
    {
      key: "moveOutScheduledDate",
      label: "퇴실예정일자",
      width: 115,
      align: "left",
      cellClassName: "",
      render: () => <GridEmptyValue />,
    },
    {
      key: "previousReading",
      label: "전월",
      width: editing ? 88 : 57,
      align: "right",
      cellClassName: "tabular-nums",
      render: (item) => editing
        ? <input aria-label={`${item.row.unitNo} 전월 지침값`} readOnly value={item.row.previousReading ?? ""} placeholder="-" className={`${inputClass()} w-full`} />
        : item.row.previousReading === null ? <GridEmptyValue /> : <span className="num">{formatNumber(item.row.previousReading)}</span>,
    },
    {
      key: "currentReading",
      label: "금월",
      width: editing ? 88 : 59,
      align: "right",
      cellClassName: "tabular-nums text-t1",
      render: (item) => editing ? (
        <input
          aria-label={`${item.row.unitNo} 당월 지침값`}
          type="number"
          min="0"
          step="0.01"
          value={item.draft.currentReading}
          placeholder="-"
          onChange={(event) => onDraftChange(item.row.unitId, { currentReading: event.target.value })}
          className={`${inputClass()} w-full`}
        />
      ) : item.current === null ? <GridEmptyValue /> : <span className="num font-semibold">{formatNumber(item.current)}</span>,
    },
    {
      key: "usage",
      label: "량",
      width: editing ? 115 : 49,
      align: "right",
      cellClassName: (item) => `font-semibold tabular-nums ${item.invalidUsage || (item.vacant && (item.usage ?? 0) > 0) ? "text-red" : "text-t1"}`,
      render: (item) => item.invalidUsage ? (
        <span className="text-red">확인 필요</span>
      ) : editing ? (
        <span className="flex items-center gap-[5px]">
          <input aria-label={`${item.row.unitNo} 사용량`} readOnly value={item.usage ?? ""} placeholder="-" className={`${inputClass()} w-[56px]`} />
          <span className="flex size-[22px] flex-none items-center justify-center"><Image src="/figma-assets/gas/lock.svg" alt="잠금" width={12} height={12} /></span>
        </span>
      ) : item.usage === null ? <GridEmptyValue /> : <span className="num">{formatNumber(item.usage)}</span>,
    },
    {
      key: "previousUsage",
      label: "전.량",
      width: 56,
      align: "right",
      cellClassName: "num",
      render: () => <GridEmptyValue />,
    },
    {
      key: "change",
      label: "증감",
      width: 53,
      align: "right",
      cellClassName: "num",
      render: () => <GridEmptyValue />,
    },
    {
      key: "manualCharge",
      label: "수동입력",
      width: editing ? 115 : 74,
      align: "right",
      cellClassName: "",
      render: (item) => editing ? (
        <span className="flex items-center gap-[5px]">
          <input
            aria-label={`${item.row.unitNo} 수동 입력 요금`}
            type="number"
            min="0"
            value={item.draft.manualCharge}
            onChange={(event) => onDraftChange(item.row.unitId, { manualCharge: event.target.value })}
            className={`${inputClass()} w-[56px]`}
          />
          <span className="flex size-[22px] flex-none items-center justify-center"><Image src="/figma-assets/gas/lock.svg" alt="잠금" width={12} height={12} /></span>
        </span>
      ) : item.row.manualCharge === null ? <GridEmptyValue /> : <span className="num">{formatNumber(item.row.manualCharge)}</span>,
    },
    {
      key: "discountType",
      label: "할인유형",
      width: 90,
      align: "left",
      cellClassName: "",
      render: (item) => item.row.discountType ?? <GridEmptyValue />,
    },
    {
      key: "discountAmount",
      label: "할인금액",
      width: 76,
      align: "right",
      cellClassName: "num",
      render: (item) => item.row.discountAmount === null ? <GridEmptyValue /> : formatNumber(item.row.discountAmount),
    },
    {
      key: "charge",
      label: "부과액",
      width: 71,
      align: "right",
      cellClassName: "num font-semibold text-t1",
      render: (item) => item.charge === null ? <GridEmptyValue /> : formatNumber(item.charge),
    },
    {
      key: "note",
      label: "적요",
      width: editing ? 152 : 120,
      align: "left",
      cellClassName: "",
      render: (item) => editing ? (
        <input
          aria-label={`${item.row.unitNo} 적요`}
          value={item.draft.note}
          onChange={(event) => onDraftChange(item.row.unitId, { note: event.target.value })}
          className={`${inputClass()} w-full text-left`}
        />
      ) : item.row.note ?? <GridEmptyValue />,
    },
    {
      key: "processedAt",
      label: "처리일자",
      width: 112,
      align: "left",
      cellClassName: (item) => item.row.processedAt ? "" : "text-t3",
      render: (item) => item.row.processedAt?.slice(0, 10) ?? <GridEmptyValue />,
    },
    {
      key: "chargeBasis",
      label: "부과기준",
      width: 197,
      align: "left",
      cellClassName: "truncate",
      render: (item) => item.row.unitPrice !== null ? `단가 ${formatNumber(item.row.unitPrice, { fractionDigits: 1 })}` : "단가 미설정",
    },
    {
      key: "tenantName",
      label: "이름",
      width: 67,
      align: "left",
      cellClassName: "truncate",
      render: (item) => item.row.tenantName ?? <GridEmptyValue />,
    },
    {
      key: "phone",
      label: "전화",
      width: 137,
      align: "left",
      cellClassName: "",
      render: () => <GridEmptyValue />,
    },
    {
      key: "line",
      label: "라인",
      width: 53,
      align: "left",
      cellClassName: "truncate",
      render: (item) => item.row.customerNumber ?? <GridEmptyValue />,
    },
    {
      key: "residentCount",
      label: "인원",
      width: 53,
      align: "right",
      cellClassName: "num",
      render: () => <GridEmptyValue />,
    },
  ];

  return (
    <section className="flex min-h-[360px] flex-1 flex-col overflow-hidden rounded-card bg-white shadow-card">
      <div className="flex h-[49px] flex-none items-center gap-2.5 border-b border-line2 px-[18px]">
        <h2 className="whitespace-nowrap text-[15px] font-extrabold text-t1">호실별 {utilityLabel} 지침</h2>
        <div className="flex-1" />
        <div className="ml-3 flex items-center gap-3 whitespace-nowrap text-[11.5px] font-medium text-t3">
          <span className="flex items-center gap-[5px]"><i className="h-3 w-[3px] rounded-[2px] bg-blue2" />퇴실 예정</span>
          <span className="flex items-center gap-[5px]"><i className="h-3 w-[3px] rounded-[2px] bg-red" />공실 사용량</span>
          <span className="flex items-center gap-[5px]"><i className="h-3 w-[3px] rounded-[2px] bg-green" />최근 입주</span>
        </div>
      </div>

      <UtilityGrid
        columns={columns}
        rows={preparedRows}
        rowKey={(item) => item.row.unitId}
        editing={editing}
        layout="fixed"
        tableWidth={editing ? 1922 : 1722}
        rowClassName={(item) => `bg-white hover:bg-row-hover ${item.vacant && (item.usage ?? 0) <= 0 ? "opacity-55" : ""}`}
        empty={(
          <div className="flex h-full flex-col items-center justify-center gap-1.5 px-6 pb-14 pt-12 text-center">
            <p className="text-[16px] font-semibold tracking-[-0.02em] text-t1">건물을 선택해 주세요</p>
            <p className="text-[13px] font-normal leading-[1.55] text-t3">선택한 건물의 고객번호가 여기에 표시돼요</p>
          </div>
        )}
        className="min-h-0 flex-1"
      />
    </section>
  );
}
