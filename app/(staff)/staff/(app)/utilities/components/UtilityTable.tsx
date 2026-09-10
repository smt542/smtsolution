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

const EMPTY_DRAFT: UtilityDraft = {
  previousReading: "",
  currentReading: "",
  usage: "",
  manualCharge: "",
  note: "",
};

export interface UtilityTableRow extends UtilityUnitRow {
  fixedUsage: number | null;
  fixedUsageFrom?: string | null;
}

interface UtilityTableProps {
  rows: UtilityTableRow[];
  drafts: Record<number, UtilityDraft>;
  referenceDate: string;
  editing?: boolean;
  selectedRowId?: number | null;
  onDraftChange: (unitId: number, patch: Partial<UtilityDraft>) => void;
  onRowClick: (row: UtilityUnitRow) => void;
  onDiscountClick?: (row: UtilityUnitRow) => void;
  onFixedUsageClick?: (row: UtilityTableRow) => void;
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

function parseNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

const head = "h-[37px] border-b border-line bg-[#FBFCFD] px-4 text-left text-[12px] font-bold whitespace-nowrap text-t3";
const cell = "border-b border-line2 px-4 text-[13.5px] whitespace-nowrap";
const numericInput = "num h-[26px] w-14 rounded-[7px] border border-teal bg-white px-[7px] text-right text-[11.5px] font-semibold text-t1 outline-none focus:ring-1 focus:ring-teal/20 disabled:border-line disabled:bg-line2 disabled:text-t4";

function ReadingInput({
  label,
  value,
  disabled,
  step,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  step: string;
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
      placeholder="-"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(event) => onChange(event.target.value)}
      className={numericInput}
    />
  );
}

export function UtilityTable({
  rows,
  drafts,
  referenceDate,
  editing = true,
  selectedRowId = null,
  onDraftChange,
  onRowClick,
  onDiscountClick,
  onFixedUsageClick,
}: UtilityTableProps) {
  return (
    <div className="h-full overflow-auto">
      <table className="w-full min-w-[1640px] border-collapse">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className={`${head} w-10 text-center`}>No.</th>
            <th className={`${head} w-20`}>호실명</th>
            <th className={`${head} w-24`}>입주자명</th>
            <th className={`${head} w-24`}>고객번호</th>
            <th className={`${head} w-24`}>계량기번호</th>
            <th className={`${head} w-20 text-right`}>전월 지침값</th>
            <th className={`${head} w-24 text-right`}>당월 지침값</th>
            <th className={`${head} w-20 text-right`}>사용량</th>
            <th className={`${head} w-20 text-right`}>고정량</th>
            <th className={`${head} w-20 text-right`}>단가</th>
            <th className={`${head} w-24 text-right`}>자동요금</th>
            <th className={`${head} w-28 text-right`}>수동 입력 요금</th>
            <th className={`${head} w-24 text-right`}>할인금액</th>
            <th className={`${head} w-24 text-right`}>부과액</th>
            <th className={`${head} w-44`}>적요</th>
            <th className={`${head} w-28`}>부과 처리일</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <UtilityRow
              key={row.unitId}
              index={index}
              row={row}
              draft={drafts[row.unitId] ?? EMPTY_DRAFT}
              referenceDate={referenceDate}
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
  index, row, draft, referenceDate, editing, selected, onDraftChange,
  onRowClick, onDiscountClick, onFixedUsageClick,
}: {
  index: number;
  row: UtilityTableRow;
  draft: UtilityDraft;
  referenceDate: string;
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
  // Server-authoritative review flag (persisted negative usage) OR a live-edited
  // negative delta. row.needsReview reflects the saved reading; the local check
  // covers unsaved edits before the next save round-trips.
  const invalidUsage = row.needsReview || (row.fixedUsage === null && usage !== null && usage < 0);
  const unitPrice = row.unitPrice ?? row.resolvedUnitPrice;
  const manual = parseNumber(draft.manualCharge);
  const charge = manual ?? row.automaticCharge;
  const marker = movingOut
    ? "shadow-[inset_3px_0_0_#3182F6]"
    : vacant && (usage ?? 0) > 0
      ? "shadow-[inset_3px_0_0_#F04452]"
      : recent
        ? "shadow-[inset_3px_0_0_#12B886]"
        : "";

  return (
    <tr onClick={() => onRowClick(row)} className={`${editing ? "h-[51px]" : "h-[41px]"} cursor-pointer transition-colors ${selected ? "bg-blue-t" : "bg-white hover:bg-[#FBFCFD]"} ${vacant && (usage ?? 0) <= 0 ? "opacity-55" : ""}`}>
      <td className={`${cell} ${marker} text-center text-t3`}>{index + 1}</td>
      <td className={`${cell} font-bold text-t1`}>{row.dong ? `${row.dong} ` : ""}{row.unitNo}</td>
      <td className={`${cell} text-t2`}>
        <div className="flex items-center gap-1.5">
          <span className={vacant ? "text-red" : movingOut ? "text-blue2" : recent ? "text-green" : ""}>{vacant ? "공실" : row.tenantName || "이름 미등록"}</span>
          {editing && onDiscountClick && !vacant && <button type="button" aria-label={`${row.unitNo} 수도 할인 설정`} onClick={(event) => { event.stopPropagation(); onDiscountClick(row); }} className="rounded border border-line px-1.5 py-0.5 text-[10px] font-bold text-t3 hover:bg-bg">할인</button>}
        </div>
      </td>
      <td className={`${cell} text-t2`}>{row.customerNumber || "-"}</td>
      <td className={`${cell} text-t3`}>{row.meterNumber || "-"}</td>
      <td className={`${cell} text-right`} onClick={(event) => event.stopPropagation()}>
        {editing ? <ReadingInput label={`${row.unitNo} 전월 지침값`} value={draft.previousReading} disabled={vacant} step="0.01" onChange={(value) => onDraftChange(row.unitId, { previousReading: value })} /> : <span className="num text-t2"><ReadingValue value={row.previousReading} /></span>}
      </td>
      <td className={`${cell} text-right`} onClick={(event) => event.stopPropagation()}>
        {editing ? <ReadingInput label={`${row.unitNo} 당월 지침값`} value={draft.currentReading} disabled={vacant} step="0.01" onChange={(value) => onDraftChange(row.unitId, { currentReading: value })} /> : <span className="num font-semibold text-t1"><ReadingValue value={row.currentReading} /></span>}
      </td>
      <td className={`${cell} text-right`} onClick={(event) => event.stopPropagation()}>
        {editing ? <ReadingInput label={`${row.unitNo} 사용량`} value={draft.usage} disabled={vacant} step="0.01" onChange={(value) => onDraftChange(row.unitId, { usage: value })} /> : <span className={`num font-semibold ${invalidUsage ? "text-red" : "text-t1"}`}>{invalidUsage ? "확인 필요" : <ReadingValue value={usage} />}</span>}
      </td>
      <td className={`${cell} num text-right`}>
        <div className="flex items-center justify-end gap-1">
          {!editing && row.fixedUsage !== null && row.fixedUsage > 0 && (
            <span
              title="매월 자동 적용되는 고정 사용량입니다. 값이 유효한지 확인하세요."
              className="rounded border border-amber-t bg-amber-t px-1.5 py-0.5 text-[10px] font-bold text-amber"
            >
              고정<span className="ml-0.5 opacity-80">확인</span>
            </span>
          )}
          <span className="text-t2"><ReadingValue value={row.fixedUsage} /></span>
          {editing && onFixedUsageClick && !vacant && <button type="button" aria-label={`${row.unitNo} 고정 사용량 설정`} title={row.fixedUsage === null ? undefined : "매월 자동 적용되는 고정 사용량입니다. 값이 유효한지 확인하세요."} onClick={(event) => { event.stopPropagation(); onFixedUsageClick(row); }} className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${row.fixedUsage === null ? "border-line text-t3 hover:bg-bg" : "border-amber-t bg-amber-t text-amber hover:bg-amber-t"}`}>{row.fixedUsage === null ? "설정" : "고정"}</button>}
        </div>
      </td>
      <td className={`${cell} num text-right text-t2`}><ReadingValue value={unitPrice} /></td>
      <td className={`${cell} num text-right text-t2`}><ReadingValue value={row.automaticCharge} /></td>
      <td className={`${cell} text-right`} onClick={(event) => event.stopPropagation()}>
        {editing ? <ReadingInput label={`${row.unitNo} 수동 입력 요금`} value={draft.manualCharge} disabled={vacant} step="1" onChange={(value) => onDraftChange(row.unitId, { manualCharge: value })} /> : <span className="num text-t2"><ReadingValue value={row.manualCharge} /></span>}
      </td>
      <td className={`${cell} num text-right text-blue`}>{row.discountAmount ? `-${formatNumber(row.discountAmount)}` : "-"}</td>
      <td className={`${cell} num text-right font-bold text-t1`}>{formatNumber(charge)}</td>
      <td className={`${cell}`} onClick={(event) => event.stopPropagation()}>
        {editing ? <input aria-label={`${row.unitNo} 적요`} value={draft.note} disabled={vacant} placeholder="적요" onChange={(event) => onDraftChange(row.unitId, { note: event.target.value })} className="h-[26px] w-[120px] rounded-[7px] border border-teal bg-white px-2 text-[11.5px] text-t1 outline-none focus:ring-1 focus:ring-teal/20 disabled:border-line disabled:bg-line2" /> : <span className="text-t3">{row.note || "-"}</span>}
      </td>
      <td className={`${cell} num text-t3`}>{row.processedAt ?? "-"}</td>
    </tr>
  );
});
