import { memo, useState } from "react";
import type { UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { formatNumber } from "@/lib/format";
import { GridEmptyValue } from "./GridEmptyValue";

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
const REFERENCE_FONT = "Pretendard, -apple-system, system-ui, sans-serif";

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
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="table-fixed border-collapse text-[13.5px]" style={{ width: TABLE_WIDTH, fontFamily: REFERENCE_FONT }}>
        <colgroup>
          {COLUMNS.map(({ heading, width }) => <col key={heading} style={{ width }} />)}
        </colgroup>
        <thead className="sticky top-0 z-10 h-[37px] bg-[#FBFCFD] text-[12px] font-bold text-t3">
          <tr className="border-b border-line">
            {COLUMNS.map(({ heading, align }) => (
              <th key={heading} className={`px-3 ${align === "right" ? "text-right" : "text-left"}`}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody className="text-[13.5px] font-medium text-t1">
          {rows.map((row, index) => (
            <UtilityRow
              key={row.unitId}
              index={index}
              row={row}
              draft={drafts[row.unitId] ?? EMPTY_DRAFT}
              referenceDate={referenceDate}
              chargeStartDate={chargeStartDate}
              chargeEndDate={chargeEndDate}
              editing={editing}
              selected={selectedRowId === row.unitId}
              onDraftChange={onDraftChange}
              onRowClick={onRowClick}
              onDiscountClick={onDiscountClick}
              onFixedUsageClick={onFixedUsageClick}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const UtilityRow = memo(function UtilityRow({
  index,
  row,
  draft,
  referenceDate,
  chargeStartDate,
  chargeEndDate,
  editing,
  selected,
  onDraftChange,
  onRowClick,
  onDiscountClick,
  onFixedUsageClick,
}: {
  index: number;
  row: UtilityTableRow;
  draft: UtilityDraft;
  referenceDate: string;
  chargeStartDate?: string;
  chargeEndDate?: string;
  editing: boolean;
  selected: boolean;
  onDraftChange: UtilityTableProps["onDraftChange"];
  onRowClick: UtilityTableProps["onRowClick"];
  onDiscountClick: UtilityTableProps["onDiscountClick"];
  onFixedUsageClick: UtilityTableProps["onFixedUsageClick"];
}) {
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
  const rowClass = `${editing ? "h-[51px]" : "h-[41px]"} cursor-pointer border-b border-line2 transition-colors ${selected ? "bg-blue-t" : "bg-white hover:bg-[#FBFCFD]"} ${vacant && (usage ?? 0) <= 0 ? "opacity-55" : ""}`;
  const cellClass = "px-4 whitespace-nowrap";

  return (
    <tr onClick={() => onRowClick(row)} className={rowClass}>
      <td className={`${cellClass} ${marker} text-left font-bold text-t1`}>{row.unitNo}</td>
      <td className={`${cellClass} text-left ${recent ? "font-semibold text-green" : "text-t2"}`}>{formatDate(row.moveInDate)}</td>
      <td className={`${cellClass} text-left text-t3`}>{formatDate(row.moveOutDate ?? null)}</td>
      <td className={`${cellClass} text-left ${movingOut ? "text-blue2" : "text-t3"}`}>{formatDate(row.moveOutScheduledDate ?? null)}</td>
      <td className={`${cellClass} text-right tabular-nums`} onClick={(event) => event.stopPropagation()}>
        {editing ? <ReadingInput label={`${row.unitNo} 전월 지침값`} value={draft.previousReading} disabled={vacant} step="0.01" onChange={(value) => onDraftChange(row.unitId, { previousReading: value })} /> : <span className="font-medium"><ReadingValue value={row.previousReading} /></span>}
      </td>
      <td className={`${cellClass} text-right tabular-nums`} onClick={(event) => event.stopPropagation()}>
        {editing ? <ReadingInput label={`${row.unitNo} 금월 지침값`} value={draft.currentReading} disabled={vacant || row.fixedUsage !== null} step="0.01" onChange={(value) => onDraftChange(row.unitId, { currentReading: value })} /> : <span className="font-bold"><ReadingValue value={row.currentReading} /></span>}
      </td>
      <td className={`${cellClass} text-right tabular-nums`} onClick={(event) => event.stopPropagation()}>
        {editing ? (
          <div className="flex items-center justify-end gap-1">
            <ReadingInput label={`${row.unitNo} 사용량`} value={draft.usage} disabled={vacant} step="0.01" onChange={(value) => onDraftChange(row.unitId, { usage: value })} />
            {onFixedUsageClick && !vacant && <button type="button" aria-label={`${row.unitNo} 고정 사용량 설정`} onClick={() => onFixedUsageClick(row)} className="rounded border border-line px-1 py-0.5 text-[10px] font-bold text-t3 hover:bg-bg">{row.fixedUsage === null ? "설정" : "고정"}</button>}
          </div>
        ) : <span className={invalidUsage ? "font-semibold text-red" : ""}>{invalidUsage ? "확인 필요" : <ReadingValue value={usage} />}</span>}
      </td>
      <td className={`${cellClass} text-right tabular-nums`}><span className="font-medium"><ReadingValue value={previousUsage} /></span></td>
      <td className={`${cellClass} text-right tabular-nums ${change !== null && change > 0 ? "text-red" : ""}`}><span className="font-semibold"><ReadingValue value={change} /></span></td>
      <td className={`${cellClass} text-right`} onClick={(event) => event.stopPropagation()}>
        {editing ? <ReadingInput label={`${row.unitNo} 수동입력`} value={draft.manualCharge} disabled={vacant} step="1" onChange={(value) => onDraftChange(row.unitId, { manualCharge: value })} /> : <ReadingValue value={row.manualCharge} />}
      </td>
      <td className={`${cellClass} text-left`}>
        <span>{row.discountType || "-"}</span>
        {editing && onDiscountClick && !vacant && <button type="button" aria-label={`${row.unitNo} 할인 설정`} onClick={(event) => { event.stopPropagation(); onDiscountClick(row); }} className="ml-1 rounded border border-line px-1 py-0.5 text-[10px] font-bold text-t3 hover:bg-bg">설정</button>}
      </td>
      <td className={`${cellClass} text-right tabular-nums text-red`}>{row.discountAmount ? `-${formatNumber(row.discountAmount)}` : "-"}</td>
      <td className={`${cellClass} text-right font-bold tabular-nums`}>{formatNumber(charge)}</td>
      <td className={`${cellClass} text-left`} onClick={(event) => event.stopPropagation()}>
        {editing ? <input aria-label={`${row.unitNo} 적요`} value={draft.note} disabled={vacant} placeholder="-" onChange={(event) => onDraftChange(row.unitId, { note: event.target.value })} className="h-[26px] w-full rounded-[7px] border border-teal bg-white px-2 text-[11.5px] text-t1 outline-none focus:ring-1 focus:ring-teal/20 disabled:border-line disabled:bg-line2" /> : row.note || "-"}
      </td>
      <td className={`${cellClass} text-left tabular-nums text-t3`}>{formatDate(row.processedAt)}</td>
      <td className={`${cellClass} text-left text-[10.5px] text-t3`}>{formatBasis(chargeStartDate, chargeEndDate)}</td>
      <td className={`${cellClass} text-left font-semibold`}>{vacant ? "공실" : row.tenantName || "-"}</td>
      <td className={`${cellClass} text-left text-t3`}>{row.phone || "-"}</td>
      <td className={`${cellClass} text-right tabular-nums`}>{index + 1}</td>
      <td className={`${cellClass} text-right tabular-nums`}>{row.residentCount ?? "-"}</td>
    </tr>
  );
});
