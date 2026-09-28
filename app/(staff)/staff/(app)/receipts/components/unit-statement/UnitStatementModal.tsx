"use client";

import { useEffect, useMemo, useState } from "react";
import { CustomDropdown } from "@/components/common/CustomDropdown";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { CloseIcon, PrinterIcon } from "@/components/icons";
import type { Building } from "@/hooks/reactquery/buildings";
import { useFeeItems } from "@/hooks/reactquery/feeItems";
import { useReceiptStatementData } from "@/hooks/reactquery/receipts";
import type { UtilityType } from "@/hooks/reactquery/utilities";
import { formatNumber } from "@/lib/format";
import { AsyncContentState } from "../AsyncContentState";
import { shiftMonth } from "../monthly/buildMonthlyReport";
import { ReportTable3, type ReportColumn, type ReportLine } from "../report-table/ReportTable3";
import {
  buildUnitStatementReport,
  type UnitStatementReportModel,
  type UnitStatementRow,
  type UnitStatementScope,
} from "./buildUnitStatementReport";
import { UnitStatementPrint } from "../print/UnitStatementPrint";

const UTILITY_OPTIONS: Array<{ type: UtilityType; label: string }> = [
  { type: "electricity", label: "전기 표시" },
  { type: "water", label: "수도 표시" },
  { type: "gas", label: "가스 표시" },
];

const pad = (value: number) => String(value).padStart(2, "0");
const toPeriod = (month: string) => `${month}-01`;
const textValue = (value: number | null) => (value === null ? "" : formatNumber(value));

// 정본 openUnitStmt: 선택한 달부터 거꾸로 12개월(`for(let k=0;k<12;k++)`).
const STATEMENT_MONTHS = 12;

function periodsEndingAt(month: string) {
  return Array.from({ length: STATEMENT_MONTHS }, (_, index) =>
    toPeriod(shiftMonth(month, index - (STATEMENT_MONTHS - 1))),
  );
}

function reportLines(lines: string[]): ReportLine[] {
  return lines.map((text) => ({ text }));
}

function rowCells(row: UnitStatementRow): ReportLine[][] {
  return [
    reportLines([row.periodLabel, "", row.paymentDateLabel]),
    reportLines([textValue(row.charged), textValue(row.lateFee), textValue(row.paid)]),
    reportLines(row.utilityAmounts.map(textValue)),
    reportLines(row.meterReadings.map(textValue)),
    reportLines([textValue(row.unitPrice)]),
    ...row.feeValues.map((values) => reportLines(values.map(textValue))),
  ];
}

const footerCellClass =
  "sticky bottom-0 border-t-[1.5px] border-line bg-[#F7F9FA] px-[16px] py-[9px] align-middle text-[13.5px] font-normal text-red";

// 정본 `#usFoot`의 `.us-tot` 빨강 합계를 표 안 한 행으로 유지한다.
function StatementFooter({ model, columnCount }: { model: UnitStatementReportModel; columnCount: number }) {
  return (
    <tr>
      <td className={`${footerCellClass} text-center`}>미납액</td>
      <td className={`${footerCellClass} num text-right`}>{formatNumber(model.totals.unpaid)}</td>
      <td className={`${footerCellClass} text-center`}>연체료</td>
      <td className={`${footerCellClass} num text-right`}>{formatNumber(model.totals.lateFee)}</td>
      <td className={`${footerCellClass} text-center`}>미납합계</td>
      <td className={`${footerCellClass} num text-right`}>{formatNumber(model.totals.total)}</td>
      <td colSpan={columnCount - 6} className={footerCellClass} />
    </tr>
  );
}

function StatementTable({ model, showFooter = true }: { model: UnitStatementReportModel; showFooter?: boolean }) {
  // 정본 `.hf-tbl.ac-tbl.us-tbl`의 호실 명세서 열 폭과 머리 3줄을 유지한다.
  const columns: ReportColumn[] = [
    { key: "period", minWidth: 84, align: "left", headerAlign: "center", header: ["년 월", "", "수납일"] },
    { key: "monthly", minWidth: 80, align: "right", headerAlign: "right", header: ["당월계", "연체료", "수납액"] },
    { key: "utilities", minWidth: 84, align: "right", headerAlign: "right", header: ["전기금액", "수도금액", "가스금액"] },
    { key: "meter", minWidth: 66, align: "right", headerAlign: "right", header: ["금월", "전월", "량"] },
    { key: "unit-price", minWidth: 64, align: "right", headerAlign: "right", header: ["단가", "", ""] },
    ...model.feeColumns.map((column): ReportColumn => ({
      key: column.key,
      minWidth: 96,
      align: "right",
      headerAlign: "right",
      header: [column.labels[0] ?? "", column.labels[1] ?? "", column.labels[2] ?? ""],
    })),
  ];
  const rows = model.rows.map((row) => ({ key: row.key, cells: rowCells(row) }));

  return (
    <ReportTable3
      columns={columns}
      rows={rows}
      lineWeight="normal"
      footer={showFooter ? <StatementFooter model={model} columnCount={columns.length} /> : undefined}
    />
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
    <label className={`flex cursor-pointer items-center gap-[6px] text-[12px] font-semibold ${checked ? "text-t1" : "text-t3"}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        className={`flex h-[17px] w-[17px] items-center justify-center rounded-[5px] border text-[11px] ${checked ? "border-teal bg-teal text-white" : "border-line bg-surface text-transparent"}`}
      >
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
  const [printing, setPrinting] = useState(false);

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
  const feeItemsQuery = useFeeItems(open && building.typeId !== null ? building.typeId : 0);
  const model = useMemo(
    () =>
      buildUnitStatementReport(
        query.data,
        unitId,
        periods,
        utilityTypes,
        scope,
        feeItemsQuery.data,
      ),
    [query.data, unitId, periods, utilityTypes, scope, feeItemsQuery.data],
  );

  if (!open) return null;

  const isStatementInitialLoading = query.isLoading;
  const isStatementRefreshing = query.isFetching && !query.isLoading;
  const isStatementBusy = isStatementInitialLoading || isStatementRefreshing;
  const hasData = model.rows.length > 0;
  const resolvedUnitLabel = model.unitLabel === "선택 호실" ? unitLabel : model.unitLabel;
  // 정본 제목은 호수와 '호' 사이를 띄운다(`[ 광원타운 101 호 ]`).
  const titleUnitLabel = resolvedUnitLabel.replace(/\s*호$/, " 호");
  const years = Array.from({ length: 3 }, (_, index) => initialYear - index);
  const yearOptions = years.map((value) => ({ value: String(value), label: `${value}년` }));
  const monthOptions = Array.from({ length: 12 }, (_, index) => {
    const value = index + 1;
    return { value: String(value), label: `${value}월` };
  });

  return (
    <>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-scrim p-6"
        onClick={onClose}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="unit-statement-title"
          className="flex h-[720px] max-h-[calc(100vh-48px)] w-[1240px] max-w-[calc(100vw-48px)] flex-col overflow-hidden rounded-[20px] bg-surface leading-[normal] shadow-pop"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="flex h-[61px] shrink-0 items-center border-b border-line px-[20px]">
            <h2 id="unit-statement-title" className="text-[16px] font-extrabold text-t1">호실 명세서</h2>
            <div className="flex-1" />
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] border border-line bg-surface text-t3 transition-[border-color,background] duration-[120ms] hover:border-[#C9D0D8] hover:bg-[#F7F9FA] hover:text-t2"
            >
              <CloseIcon className="h-[14px] w-[14px]" />
            </button>
          </header>

          <div className="flex shrink-0 items-center gap-[8px] border-b border-line bg-surface px-[16px] py-[13px]">
            {/* 정본 `.auto-bar`의 compact `.uc-dd` 필터 규격을 사용한다. */}
            <CustomDropdown
              ariaLabel="명세서 연도"
              value={String(year)}
              options={yearOptions}
              onChange={(value) => setYear(Number(value))}
              size="compact"
              position="fixed"
              menuMinWidth={100}
            />
            <CustomDropdown
              ariaLabel="명세서 월"
              value={String(month)}
              options={monthOptions}
              onChange={(value) => setMonth(Number(value))}
              size="compact"
              position="fixed"
              menuMinWidth={100}
            />
            <SegmentedControl
              options={[
                { value: "all", label: "전체" },
                { value: "unpaid", label: "미납만" },
              ]}
              value={scope}
              onChange={(value) => {
                if (value === "all" || value === "unpaid") setScope(value);
              }}
              size="sm"
            />
            <div className="ml-[4px] flex items-center gap-[10px]">
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
          </div>

          {/* 정본 `.ac-head{padding:15px 16px 13px}` + `.ac-title{margin-bottom:10px}` — KPI 줄이 없어도 제목 아래 10px을 남긴다. */}
          <div className="shrink-0 border-b border-line bg-surface px-[16px] pb-[13px] pt-[15px]">
            <p className="mb-[10px] text-center text-[15px] font-bold tracking-[-0.02em] text-t1">
              [ {building.name} {titleUnitLabel} ]
            </p>
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

          <footer className="flex h-[69px] shrink-0 items-center justify-end border-t border-line px-[20px]">
            <button
              type="button"
              onClick={() => {
                if (printing) return;
                setPrinting(true);
              }}
              disabled={!hasData || isStatementBusy || query.isError}
              className="flex h-[40px] items-center gap-[7px] rounded-[11px] bg-teal px-[18px] text-[13.5px] font-bold text-white hover:bg-teal-d disabled:opacity-40"
            >
              <PrinterIcon className="h-[16px] w-[16px]" />
              출력
            </button>
          </footer>
        </section>
      </div>

      {printing && (
        <UnitStatementPrint
          buildingName={building.name}
          titleUnitLabel={titleUnitLabel}
          rows={model.rows}
          feeColumns={model.feeColumns}
          totals={model.totals}
          onDone={() => setPrinting(false)}
        />
      )}
    </>
  );
}
