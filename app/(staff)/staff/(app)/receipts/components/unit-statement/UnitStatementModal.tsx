"use client";

import { useEffect, useMemo, useState } from "react";
import { CloseIcon, PrinterIcon } from "@/components/icons";
import type { Building } from "@/hooks/reactquery/buildings";
import { useReceiptStatementData } from "@/hooks/reactquery/receipts";
import type { UtilityType } from "@/hooks/reactquery/utilities";
import { formatNumber } from "@/lib/format";
import { AsyncContentState } from "../AsyncContentState";
import { shiftMonth } from "../monthly/buildMonthlyReport";
import {
  buildUnitStatementReport,
  type UnitStatementReportModel,
  type UnitStatementRow,
  type UnitStatementScope,
} from "./buildUnitStatementReport";

const UTILITY_OPTIONS: Array<{ type: UtilityType; label: string }> = [
  { type: "electricity", label: "전기 표시" },
  { type: "water", label: "수도 표시" },
  { type: "gas", label: "가스 표시" },
];

const FIXED_WIDTHS = [140, 115, 110, 80, 80];
const FEE_WIDTH = 103;
// Figma 명세서가 사용하는 고정 열 앵커. 열 박스는 인쇄 폭을 유지하고 텍스트만 시안 위치에 정렬한다.
const HEADER_CONTENT_OFFSETS = [-15, -20, -41, -48, -37, -25, -33, -22, -20, -13, -5, 7];
const DATA_CONTENT_OFFSETS = [6, -26, -39, -49, -42, -27, -30, -22, -19, -13, -5, 7];
const pad = (value: number) => String(value).padStart(2, "0");
const toPeriod = (month: string) => `${month}-01`;
const textValue = (value: number | null) => (value === null ? "" : formatNumber(value));

function periodsEndingAt(month: string) {
  return Array.from({ length: 5 }, (_, index) => toPeriod(shiftMonth(month, index - 4)));
}

function StackCell({
  width,
  lines,
  align = "right",
  header = false,
  contentOffset = 0,
}: {
  width: number;
  lines: string[];
  align?: "left" | "center" | "right";
  header?: boolean;
  contentOffset?: number;
}) {
  const alignment = align === "left" ? "text-left" : align === "center" ? "text-center" : "text-right";
  return (
    <div
      style={{ width }}
      className={`flex h-[73px] shrink-0 flex-col justify-center px-[10px] ${alignment} ${header ? "text-[11px] font-medium text-t1" : "text-[12px] font-medium tabular-nums text-t1"}`}
    >
      {lines.map((line, index) => (
        <span
          key={index}
          style={{ transform: `translateX(${contentOffset}px)` }}
          className="block min-h-[17px] truncate leading-[17px]"
          title={line}
        >
          {line || " "}
        </span>
      ))}
    </div>
  );
}

function rowCells(row: UnitStatementRow) {
  return [
    [row.periodLabel, row.paymentDateLabel],
    [textValue(row.charged), textValue(row.lateFee), textValue(row.paid)],
    row.utilityAmounts.map(textValue),
    row.meterReadings.map(textValue),
    [textValue(row.unitPrice)],
    ...row.feeValues.map((values) => values.map(textValue)),
  ];
}

function StatementTable({ model }: { model: UnitStatementReportModel }) {
  const headers = [
    ["년 월", "수납일"],
    ["당월계", "연체료", "수납액"],
    ["전기금액", "수도금액", "가스금액"],
    ["금월", "전월", "량"],
    ["단가"],
    ...model.feeColumns.map((column) => column.labels),
  ];
  const widths = [...FIXED_WIDTHS, ...model.feeColumns.map(() => FEE_WIDTH)];
  const totalWidth = Math.max(1240, widths.reduce((sum, width) => sum + width, 0));

  return (
    <div className="min-w-full" style={{ width: totalWidth }}>
      <div className="sticky top-0 z-10 flex border-b border-line bg-[#f7f9fa]">
        {headers.map((lines, index) => (
          <StackCell
            key={index}
            width={widths[index]}
            lines={lines}
            align="center"
            header
            contentOffset={HEADER_CONTENT_OFFSETS[index] ?? 0}
          />
        ))}
      </div>
      {model.rows.map((row) => (
        <div key={row.key} className="flex border-b border-line2">
          {rowCells(row).map((lines, index) => (
            <StackCell
              key={index}
              width={widths[index]}
              lines={lines}
              align={index === 0 ? "left" : "center"}
              contentOffset={DATA_CONTENT_OFFSETS[index] ?? 0}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function ToggleCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-[6px] text-[12px] font-bold text-t2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span className="flex h-[17px] w-[17px] items-center justify-center rounded-[6px] border border-line bg-surface text-[11px] text-transparent peer-checked:border-teal peer-checked:bg-teal peer-checked:text-white">
        ✓
      </span>
      {label}
    </label>
  );
}

export function UnitStatementModal({
  open,
  onClose,
  building,
  unitId,
  unitLabel,
  period,
}: {
  open: boolean;
  onClose: () => void;
  building: Building;
  unitId: number;
  unitLabel: string;
  period: string;
}) {
  const initialMonth = period.slice(0, 7);
  const initialYear = Number(initialMonth.slice(0, 4));
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(Number(initialMonth.slice(5, 7)));
  const [scope, setScope] = useState<UnitStatementScope>("all");
  const [utilitySelection, setUtilitySelection] = useState<Record<UtilityType, boolean>>({
    electricity: true,
    water: true,
    gas: true,
  });

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const selectedMonth = `${year}-${pad(month)}`;
  const periods = useMemo(() => periodsEndingAt(selectedMonth), [selectedMonth]);
  const utilityTypes = UTILITY_OPTIONS
    .filter(({ type }) => utilitySelection[type])
    .map(({ type }) => type);
  const query = useReceiptStatementData(
    building.id,
    unitId,
    periods[0],
    periods.at(-1) ?? periods[0],
    open,
  );
  const model = useMemo(
    () => buildUnitStatementReport(query.data, unitId, periods, utilityTypes, scope),
    [query.data, unitId, periods, utilityTypes, scope],
  );

  if (!open) return null;

  const years = Array.from({ length: 11 }, (_, index) => initialYear - 5 + index);
  const isStatementInitialLoading = query.isLoading;
  const isStatementRefreshing = query.isFetching && !query.isLoading;
  const isStatementBusy = isStatementInitialLoading || isStatementRefreshing;
  const hasData = model.rows.length > 0;
  const resolvedUnitLabel = model.unitLabel === "선택 호실" ? unitLabel : model.unitLabel;

  return (
    <>
      <style>{"@media print { @page { size: A4 landscape; margin: 8mm; } }"}</style>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-scrim p-6 print:hidden"
        onClick={onClose}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="unit-statement-title"
          className="flex h-[720px] max-h-[calc(100vh-48px)] w-[1240px] max-w-[calc(100vw-48px)] flex-col overflow-hidden rounded-[20px] bg-surface shadow-pop"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="flex h-[61px] shrink-0 items-center border-b border-line px-[20px]">
            <h2 id="unit-statement-title" className="text-[16px] font-extrabold text-t1">호실 명세서</h2>
            <div className="flex-1" />
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] border border-line text-t3 hover:bg-bg"
            >
              <CloseIcon className="h-[14px] w-[14px]" />
            </button>
          </header>

          <div className="flex h-[59px] shrink-0 items-center gap-[8px] border-b border-line px-[16px]">
            <select
              aria-label="명세서 연도"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="h-[32px] rounded-[9px] border border-line bg-surface px-[11px] text-[13px] font-bold text-t1 outline-none focus:border-teal"
            >
              {years.map((value) => <option key={value} value={value}>{value}년</option>)}
            </select>
            <select
              aria-label="명세서 월"
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
              className="h-[32px] rounded-[9px] border border-line bg-surface px-[11px] text-[13px] font-bold text-t1 outline-none focus:border-teal"
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>{value}월</option>
              ))}
            </select>
            <div className="flex rounded-[10px] bg-bg p-[2px] text-[12px] font-bold">
              {(["all", "unpaid"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScope(value)}
                  className={`h-[28px] rounded-[8px] px-[13px] ${scope === value ? "bg-surface text-t1 shadow-sm" : "text-t4"}`}
                >
                  {value === "all" ? "전체" : "미납만"}
                </button>
              ))}
            </div>
            {UTILITY_OPTIONS.map(({ type, label }) => (
              <ToggleCheckbox
                key={type}
                checked={utilitySelection[type]}
                label={label}
                onChange={(checked) =>
                  setUtilitySelection((current) => ({ ...current, [type]: checked }))
                }
              />
            ))}
          </div>

          <div className="flex h-[59px] shrink-0 items-center justify-center border-b border-line">
            <p className="text-[15px] font-bold text-t1">[ {building.name} {resolvedUnitLabel} ]</p>
          </div>

          <AsyncContentState
            error={query.isError}
            errorMessage="호실 명세서를 불러오지 못했습니다."
            loading={isStatementInitialLoading}
            loadingLabel="호실 명세서 불러오는 중"
            refreshing={isStatementRefreshing}
            refreshingLabel="호실 명세서 갱신 중"
            empty={!hasData}
            emptyMessage="조회된 호실 명세서가 없습니다."
          >
            <StatementTable model={model} />
          </AsyncContentState>

          <div className="flex h-[36px] shrink-0 items-center gap-[34px] border-t border-line bg-[#f7f9fa] px-[38px] text-[13px] font-medium text-red tabular-nums">
            <span>미납액</span><strong>{formatNumber(model.totals.unpaid)}</strong>
            <span>연체료</span><strong>{formatNumber(model.totals.lateFee)}</strong>
            <span>미납합계</span><strong>{formatNumber(model.totals.total)}</strong>
          </div>
          <footer className="flex h-[69px] shrink-0 items-center justify-end border-t border-line px-[20px]">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!hasData || isStatementBusy || query.isError}
              className="flex h-[40px] items-center gap-[7px] rounded-[11px] bg-teal px-[18px] text-[13.5px] font-bold text-white hover:bg-teal-d disabled:opacity-40"
            >
              <PrinterIcon className="h-[16px] w-[16px]" />
              출력
            </button>
          </footer>
        </section>
      </div>

      {hasData && (
        <article className="hidden print:block" data-testid="unit-statement-print-root">
          <h1 className="mb-3 text-center text-xl font-bold">[ {building.name} {resolvedUnitLabel} ]</h1>
          <StatementTable model={model} />
        </article>
      )}
    </>
  );
}
