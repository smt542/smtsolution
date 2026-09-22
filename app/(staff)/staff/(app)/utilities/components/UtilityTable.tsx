import { useState } from "react";
import type { UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { formatNumber } from "@/lib/format";
import { GridEmptyValue } from "./GridEmptyValue";
import { UtilityGrid, type UtilityGridColumn } from "./UtilityGrid";

export interface UtilityDraft {
  previousReading: string;
  currentReading: string;
  usage: string;
  manualCharge: string;
  note: string;
}

const EMPTY_DRAFT: UtilityDraft = { previousReading: "", currentReading: "", usage: "", manualCharge: "", note: "" };

export interface UtilityTableRow extends UtilityUnitRow {
  fixedUsage: number | null;
  fixedUsageFrom?: string | null;
}

interface UtilityTableProps {
  rows: UtilityTableRow[];
  drafts: Record<number, UtilityDraft>;
  referenceDate: string;
  chargeStartDate?: string;
  chargeEndDate?: string;
  editing?: boolean;
  selectedRowId?: number | null;
  onDraftChange: (unitId: number, patch: Partial<UtilityDraft>) => void;
  onRowClick: (row: UtilityUnitRow) => void;
  onDiscountClick?: (row: UtilityUnitRow) => void;
  onFixedUsageClick?: (row: UtilityTableRow) => void;
}

const COLUMNS = [
  { heading: "호수", width: 59, align: "left" },
  { heading: "입주일자", width: 115, align: "left" },
  { heading: "퇴실일자", width: 112, align: "left" },
  { heading: "퇴실예정일자", width: 115, align: "left" },
  { heading: "전월", width: 88, align: "right" },
  { heading: "금월", width: 88, align: "right" },
  { heading: "량", width: 115, align: "right" },
  { heading: "전.량", width: 56, align: "right" },
  { heading: "증감", width: 53, align: "right" },
  { heading: "수동입력", width: 115, align: "right" },
  { heading: "할인유형", width: 90, align: "left" },
  { heading: "할인금액", width: 75, align: "right" },
  { heading: "부과액", width: 71, align: "right" },
  { heading: "적요", width: 152, align: "left" },
  { heading: "처리일자", width: 112, align: "left" },
  { heading: "부과기준", width: 197, align: "left" },
  { heading: "이름", width: 67, align: "left" },
  { heading: "전화", width: 137, align: "left" },
  { heading: "라인", width: 53, align: "right" },
  { heading: "인원", width: 53, align: "right" },
] as const;
const TABLE_WIDTH = COLUMNS.reduce((total, column) => total + column.width, 0);

function parseNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "-";
}

function formatBasis(start: string | undefined, end: string | undefined): string {
  if (!start || !end) return "-";
  return `${start.replaceAll("-", ".")} ~ ${end.replaceAll("-", ".")}`;
}

function ReadingValue({ value }: { value: number | null }) {
  return value === null || value === 0 ? <GridEmptyValue /> : formatNumber(value);
}

function usageFor(row: UtilityTableRow, draft: UtilityDraft): number | null {
  const enteredUsage = parseNumber(draft.usage);
  if (enteredUsage !== null) return enteredUsage;
  if (row.fixedUsage !== null) return row.fixedUsage;
  const current = parseNumber(draft.currentReading);
  const previous = parseNumber(draft.previousReading);
  if (current === null || previous === null) return row.usage;
  return current - previous;
}

function isVacant(row: UtilityUnitRow): boolean {
  return row.occupancyStatus === "vacant" || row.occupancyId === null;
}

function isNewOccupancy(moveInDate: string | null, referenceDate: string): boolean {
  if (!moveInDate || !referenceDate) return false;
  const movedAt = Date.parse(`${moveInDate}T00:00:00`);
  const basedAt = Date.parse(`${referenceDate}T00:00:00`);
  return !Number.isNaN(movedAt) && !Number.isNaN(basedAt)
    && Math.abs(movedAt - basedAt) <= 31 * 24 * 60 * 60 * 1000;
}

interface UtilityRowState {
  vacant: boolean;
  movingOut: boolean;
  recent: boolean;
  usage: number | null;
  previousUsage: number | null;
  change: number | null;
  invalidUsage: boolean;
  charge: number | null;
  marker: string;
}

function getUtilityRowState(row: UtilityTableRow, draft: UtilityDraft, referenceDate: string): UtilityRowState {
  const vacant = isVacant(row);
  const movingOut = row.occupancyStatus === "moving_out";
  const recent = !vacant && isNewOccupancy(row.moveInDate, referenceDate);
  const usage = usageFor(row, draft);
  const previousUsage = row.previousUsage ?? null;
  const change = usage === null || previousUsage === null ? null : usage - previousUsage;
  const invalidUsage = Boolean(row.needsReview) || (row.fixedUsage === null && usage !== null && usage < 0);
  const manual = parseNumber(draft.manualCharge);
  const charge = manual ?? row.automaticCharge;
  const marker = movingOut
    ? "shadow-[inset_3px_0_0_#3182F6]"
    : vacant && (usage ?? 0) > 0
      ? "shadow-[inset_3px_0_0_#F04452]"
      : recent
        ? "shadow-[inset_3px_0_0_#12B886]"
        : "";

  return { vacant, movingOut, recent, usage, previousUsage, change, invalidUsage, charge, marker };
}

const inputClass = "h-[26px] w-14 rounded-[7px] border border-teal bg-white px-[7px] text-right text-[11.5px] font-semibold text-t1 outline-none focus:ring-1 focus:ring-teal/20 disabled:border-line disabled:bg-line2 disabled:text-t4";

function ReadingInput({
  label,
  value,
  disabled,
  readOnly = false,
  step,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  readOnly?: boolean;
  step?: string;
  onChange: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const displayValue = !focused && parseNumber(value) === 0 ? "" : value;

  return (
    <input
      aria-label={label}
      type="number"
      min="0"
      step={step}
      value={displayValue}
      disabled={disabled}
      readOnly={readOnly}
      placeholder="-"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
    />
  );
}

export function UtilityTable({
  rows,
  drafts,
  referenceDate,
  chargeStartDate,
  chargeEndDate,
  editing = true,
  selectedRowId = null,
  onDraftChange,
  onRowClick,
  onDiscountClick,
  onFixedUsageClick,
}: UtilityTableProps) {
  interface PreparedUtilityRow {
    row: UtilityTableRow;
    draft: UtilityDraft;
    state: UtilityRowState;
  }

  const getDraft = (row: UtilityTableRow) => drafts[row.unitId] ?? EMPTY_DRAFT;
  const preparedRows: PreparedUtilityRow[] = rows.map((row) => {
    const draft = getDraft(row);
    return { row, draft, state: getUtilityRowState(row, draft, referenceDate) };
  });
  const columns: UtilityGridColumn<PreparedUtilityRow>[] = [
    {
      key: "unitNo",
      label: "호수",
      width: 59,
      align: "left",
      cellClassName: (item) => `${item.state.marker} font-bold text-t1`,
      render: (item) => item.row.unitNo,
    },
    {
      key: "moveInDate",
      label: "입주일자",
      width: 115,
      align: "left",
      cellClassName: (item) => item.state.recent ? "font-semibold text-green" : "text-t2",
      render: (item) => formatDate(item.row.moveInDate),
    },
    {
      key: "moveOutDate",
      label: "퇴실일자",
      width: 112,
      align: "left",
      cellClassName: "text-t3",
      render: (item) => formatDate(item.row.moveOutDate ?? null),
    },
    {
      key: "moveOutScheduledDate",
      label: "퇴실예정일자",
      width: 115,
      align: "left",
      cellClassName: (item) => item.state.movingOut ? "text-blue2" : "text-t3",
      render: (item) => formatDate(item.row.moveOutScheduledDate ?? null),
    },
    {
      key: "previousReading",
      label: "전월",
      width: 88,
      align: "right",
      cellClassName: "tabular-nums",
      stopRowClick: true,
      render: (item) => editing ? <ReadingInput label={`${item.row.unitNo} 전월 지침값`} value={item.draft.previousReading} disabled={item.state.vacant} step="0.01" onChange={(value) => onDraftChange(item.row.unitId, { previousReading: value })} /> : <span className="font-medium"><ReadingValue value={item.row.previousReading} /></span>,
    },
    {
      key: "currentReading",
      label: "금월",
      width: 88,
      align: "right",
      cellClassName: "tabular-nums",
      stopRowClick: true,
      render: (item) => editing ? <ReadingInput label={`${item.row.unitNo} 금월 지침값`} value={item.draft.currentReading} disabled={item.state.vacant || item.row.fixedUsage !== null} step="0.01" onChange={(value) => onDraftChange(item.row.unitId, { currentReading: value })} /> : <span className="font-bold"><ReadingValue value={item.row.currentReading} /></span>,
    },
    {
      key: "usage",
      label: "량",
      width: 115,
      align: "right",
      cellClassName: "tabular-nums",
      stopRowClick: true,
      render: (item) => editing ? (
        <div className="flex items-center justify-end gap-1">
          <ReadingInput label={`${item.row.unitNo} 사용량`} value={item.draft.usage} disabled={item.state.vacant} step="0.01" onChange={(value) => onDraftChange(item.row.unitId, { usage: value })} />
          {onFixedUsageClick && !item.state.vacant && <button type="button" aria-label={`${item.row.unitNo} 고정 사용량 설정`} onClick={() => onFixedUsageClick(item.row)} className="rounded border border-line px-1 py-0.5 text-[10px] font-bold text-t3 hover:bg-bg">{item.row.fixedUsage === null ? "설정" : "고정"}</button>}
        </div>
      ) : <span className={item.state.invalidUsage ? "font-semibold text-red" : ""}>{item.state.invalidUsage ? "확인 필요" : <ReadingValue value={item.state.usage} />}</span>,
    },
    {
      key: "previousUsage",
      label: "전.량",
      width: 56,
      align: "right",
      cellClassName: "tabular-nums",
      render: (item) => <span className="font-medium"><ReadingValue value={item.state.previousUsage} /></span>,
    },
    {
      key: "change",
      label: "증감",
      width: 53,
      align: "right",
      cellClassName: (item) => `tabular-nums ${item.state.change !== null && item.state.change > 0 ? "text-red" : ""}`,
      render: (item) => <span className="font-semibold"><ReadingValue value={item.state.change} /></span>,
    },
    {
      key: "manualCharge",
      label: "수동입력",
      width: 115,
      align: "right",
      cellClassName: "",
      stopRowClick: true,
      render: (item) => editing ? <ReadingInput label={`${item.row.unitNo} 수동입력`} value={item.draft.manualCharge} disabled={item.state.vacant} step="1" onChange={(value) => onDraftChange(item.row.unitId, { manualCharge: value })} /> : <ReadingValue value={item.row.manualCharge} />,
    },
    {
      key: "discountType",
      label: "할인유형",
      width: 90,
      align: "left",
      cellClassName: "",
      render: (item) => (
        <>
          <span>{item.row.discountType || "-"}</span>
          {editing && onDiscountClick && !item.state.vacant && <button type="button" aria-label={`${item.row.unitNo} 할인 설정`} onClick={(event) => { event.stopPropagation(); onDiscountClick(item.row); }} className="ml-1 rounded border border-line px-1 py-0.5 text-[10px] font-bold text-t3 hover:bg-bg">설정</button>}
        </>
      ),
    },
    {
      key: "discountAmount",
      label: "할인금액",
      width: 75,
      align: "right",
      cellClassName: "tabular-nums text-red",
      render: (item) => item.row.discountAmount ? `-${formatNumber(item.row.discountAmount)}` : "-",
    },
    {
      key: "charge",
      label: "부과액",
      width: 71,
      align: "right",
      cellClassName: "font-bold tabular-nums",
      render: (item) => formatNumber(item.state.charge),
    },
    {
      key: "note",
      label: "적요",
      width: 152,
      align: "left",
      cellClassName: "",
      stopRowClick: true,
      render: (item) => editing ? <input aria-label={`${item.row.unitNo} 적요`} value={item.draft.note} disabled={item.state.vacant} placeholder="-" onChange={(event) => onDraftChange(item.row.unitId, { note: event.target.value })} className="h-[26px] w-full rounded-[7px] border border-teal bg-white px-2 text-[11.5px] text-t1 outline-none focus:ring-1 focus:ring-teal/20 disabled:border-line disabled:bg-line2" /> : item.row.note || "-",
    },
    {
      key: "processedAt",
      label: "처리일자",
      width: 112,
      align: "left",
      cellClassName: "tabular-nums text-t3",
      render: (item) => formatDate(item.row.processedAt),
    },
    {
      key: "chargeBasis",
      label: "부과기준",
      width: 197,
      align: "left",
      cellClassName: "text-[10.5px] text-t3",
      render: () => formatBasis(chargeStartDate, chargeEndDate),
    },
    {
      key: "tenantName",
      label: "이름",
      width: 67,
      align: "left",
      cellClassName: "font-semibold",
      render: (item) => item.state.vacant ? "공실" : item.row.tenantName || "-",
    },
    {
      key: "phone",
      label: "전화",
      width: 137,
      align: "left",
      cellClassName: "text-t3",
      render: (item) => item.row.phone || "-",
    },
    {
      key: "line",
      label: "라인",
      width: 53,
      align: "right",
      cellClassName: "tabular-nums",
      render: (_item, index) => index + 1,
    },
    {
      key: "residentCount",
      label: "인원",
      width: 53,
      align: "right",
      cellClassName: "tabular-nums",
      render: (item) => item.row.residentCount ?? "-",
    },
  ];

  return (
    <UtilityGrid
      columns={columns}
      rows={preparedRows}
      rowKey={(item) => item.row.unitId}
      editing={editing}
      layout="fixed"
      tableWidth={TABLE_WIDTH}
      rowClassName={(item) => `transition-colors ${selectedRowId === item.row.unitId ? "bg-blue-t" : "bg-white hover:bg-[#FBFCFD]"} ${item.state.vacant && (item.state.usage ?? 0) <= 0 ? "opacity-55" : ""}`}
      onRowClick={(item) => onRowClick(item.row)}
      className="min-h-0 flex-1"
    />
  );
}
