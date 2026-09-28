"use client";

import { useEffect, useMemo, useState } from "react";
import { CustomDropdown } from "@/components/common/CustomDropdown";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { Spinner } from "@/components/common/Spinner";
import { CloseIcon, PrinterIcon } from "@/components/icons";
import type { Building } from "@/hooks/reactquery/buildings";
import { useReceiptStatementData } from "@/hooks/reactquery/receipts";
import { formatNumber } from "@/lib/format";
import {
  buildVillaReceiptReport,
  type VillaReceiptReportModel,
  type VillaReceiptScope,
} from "./buildVillaReceiptReport";

const pad = (value: number) => String(value).padStart(2, "0");

function periodsBetween(startYear: number, startMonth: number, endYear: number, endMonth: number) {
  const start = startYear * 12 + startMonth - 1;
  const end = endYear * 12 + endMonth - 1;
  if (start > end) return [];
  return Array.from({ length: end - start + 1 }, (_, offset) => {
    const value = start + offset;
    return `${Math.floor(value / 12)}-${pad((value % 12) + 1)}-01`;
  });
}

function ReportTable({ model }: { model: VillaReceiptReportModel }) {
  // 정본 `.hf-tbl.up-tbl`의 자동 레이아웃과 헤더 인라인 폭을 그대로 유지한다.
  const headerCellClass =
    "sticky top-0 z-[2] border-b border-line bg-[#F7F9FA] px-[16px] py-[11px] text-[11.5px] font-medium text-t3";
  const bodyCellClass =
    "border-b border-line2 px-[16px] py-[12px] text-[13.5px] font-medium text-t1";
  const footerCellClass =
    "sticky bottom-0 border-t-[1.5px] border-line bg-[#F7F9FA] px-[16px] py-[12px] text-[13.5px] font-normal text-t1";
  const headerLeftCellClass = `${headerCellClass} text-left`;
  const headerRightCellClass = `${headerCellClass} text-right`;

  return (
    <table className="w-full border-collapse whitespace-nowrap">
      <thead>
        <tr>
          <th style={{ width: 64 }} className={headerLeftCellClass}>호수</th>
          <th style={{ width: 88 }} className={headerLeftCellClass}>년월</th>
          <th style={{ minWidth: 88 }} className={headerRightCellClass}>당월계</th>
          <th style={{ minWidth: 88 }} className={headerRightCellClass}>수납액</th>
          <th style={{ minWidth: 104 }} className={headerLeftCellClass}>수납일자</th>
          <th style={{ minWidth: 84 }} className={headerLeftCellClass}>은행</th>
          <th style={{ width: 64 }} className={headerLeftCellClass}>chk</th>
          <th style={{ width: 46 }} className={headerLeftCellClass}>C</th>
          <th style={{ minWidth: 150 }} className={headerLeftCellClass}>비고</th>
        </tr>
      </thead>
      <tbody>
        {model.rows.length === 0 ? (
          // 정본 `<td colspan="9" class="lk-empty">내역이 없어요</td>` — 머리행·합계는 그대로 둔다.
          <tr>
            <td colSpan={9} className="py-[34px] text-center text-[13.5px] font-medium text-t3">내역이 없어요</td>
          </tr>
        ) : model.rows.map((row) => (
          <tr
            key={row.key}
            className="[&:nth-child(even)>td]:bg-[#FCFDFD] [&:hover>td]:!bg-blue-t2 [&:last-child>td]:border-b-0"
          >
            <td className={`${bodyCellClass} num`}>{row.showUnit ? row.unitLabel : ""}</td>
            <td className={`${bodyCellClass} num`}>{row.periodLabel}</td>
            <td className={`${bodyCellClass} num text-right`}>{formatNumber(row.charged, { nullText: "" })}</td>
            <td className={`${bodyCellClass} num text-right`}>{row.paid > 0 ? formatNumber(row.paid) : ""}</td>
            <td className={`${bodyCellClass} num`}>{row.paidAtLabel}</td>
            <td className={bodyCellClass}>{row.methodLabel}</td>
            <td className={bodyCellClass}>{row.kindLabel}</td>
            <td className={bodyCellClass} />
            <td className={bodyCellClass}>{row.memo}</td>
          </tr>
        ))}
      </tbody>
      <tfoot id="pdFoot">
        <tr>
          <td className={`${footerCellClass} text-center`}>합계</td>
          <td className={footerCellClass} />
          <td className={`${footerCellClass} num text-right`}>{formatNumber(model.totals.charged)}</td>
          <td className={`${footerCellClass} num text-right`}>{formatNumber(model.totals.paid)}</td>
          <td colSpan={5} className={footerCellClass} />
        </tr>
      </tfoot>
    </table>
  );
}

export function VillaReceiptHistoryModal({
  open,
  onClose,
  building,
  period,
}: {
  open: boolean;
  onClose: () => void;
  building: Building;
  period: string;
}) {
  const initialYear = Number(period.slice(0, 4));
  const initialMonth = Number(period.slice(5, 7));
  const [startYear, setStartYear] = useState(initialYear);
  const [startMonth, setStartMonth] = useState(initialMonth);
  const [endYear, setEndYear] = useState(initialYear);
  const [endMonth, setEndMonth] = useState(initialMonth);
  const [scope, setScope] = useState<VillaReceiptScope>("all");

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

  const periods = useMemo(
    () => periodsBetween(startYear, startMonth, endYear, endMonth),
    [startYear, startMonth, endYear, endMonth],
  );
  const query = useReceiptStatementData(
    building.id,
    null,
    periods[0] ?? "",
    periods.at(-1) ?? "",
    open && periods.length > 0,
  );
  const model = useMemo(
    () => buildVillaReceiptReport(query.data, periods, scope),
    [query.data, periods, scope],
  );

  if (!open) return null;

  const years = Array.from({ length: 3 }, (_, index) => initialYear - index);
  const yearOptions = years.map((year) => ({ value: String(year), label: `${year}년` }));
  const monthOptions = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return { value: String(month), label: `${month}월` };
  });
  const isHistoryInitialLoading = query.isLoading;
  const isHistoryRefreshing = query.isFetching && !query.isLoading;
  const isHistoryBusy = isHistoryInitialLoading || isHistoryRefreshing;
  const hasData = model.rows.length > 0;

  return (
    <>
      <style>{"@media print { @page { size: A4 landscape; margin: 8mm; } }"}</style>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim p-6 print:hidden"
        onClick={onClose}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="villa-receipt-history-title"
          className="flex h-[700px] max-h-[calc(100vh-48px)] w-[1120px] max-w-[calc(100vw-48px)] flex-col overflow-hidden rounded-[20px] bg-surface leading-[normal] shadow-pop"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="flex h-[61px] shrink-0 items-center border-b border-line px-[20px]">
            <h2 id="villa-receipt-history-title" className="text-[16px] font-extrabold text-t1">
              빌라 수납내역
            </h2>
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

          {/* 정본 `.auto-bar`의 compact `.uc-dd`와 `.auto-lbl` 필터 규격을 유지한다. */}
          <div className="flex shrink-0 items-center gap-[8px] border-b border-line bg-surface px-[16px] py-[13px]">
            <CustomDropdown
              ariaLabel="시작 연도"
              value={String(startYear)}
              options={yearOptions}
              onChange={(value) => setStartYear(Number(value))}
              size="compact"
              position="fixed"
              menuMinWidth={104}
            />
            <CustomDropdown
              ariaLabel="시작 월"
              value={String(startMonth)}
              options={monthOptions}
              onChange={(value) => setStartMonth(Number(value))}
              size="compact"
              position="fixed"
              menuMinWidth={104}
            />
            <span className="text-[12px] font-bold text-t3">~</span>
            <CustomDropdown
              ariaLabel="종료 연도"
              value={String(endYear)}
              options={yearOptions}
              onChange={(value) => setEndYear(Number(value))}
              size="compact"
              position="fixed"
              menuMinWidth={104}
            />
            <CustomDropdown
              ariaLabel="종료 월"
              value={String(endMonth)}
              options={monthOptions}
              onChange={(value) => setEndMonth(Number(value))}
              size="compact"
              position="fixed"
              menuMinWidth={104}
            />
            <div className="flex-1" />
            <SegmentedControl
              options={[
                { value: "all", label: "전체" },
                { value: "paid", label: "수납" },
              ]}
              value={scope}
              onChange={(value) => {
                if (value === "all" || value === "paid") setScope(value);
              }}
              size="sm"
            />
          </div>

          <div className="relative min-h-0 flex-1 overflow-auto bg-surface">
            {query.isError ? (
              <div role="alert" className="flex h-full items-center justify-center text-sm font-bold text-red">
                수납내역을 불러오지 못했습니다.
              </div>
            ) : isHistoryInitialLoading ? (
              <div className="flex h-full items-center justify-center">
                <Spinner label="수납내역 불러오는 중" />
              </div>
            ) : (
              <>
                <ReportTable model={model} />
                {isHistoryRefreshing ? (
                  <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-surface/95 shadow-card">
                    <Spinner label="수납내역 갱신 중" size="small" showLabel className="px-3 py-2" />
                  </div>
                ) : null}
              </>
            )}
          </div>

          <footer className="flex h-[69px] shrink-0 items-center justify-end border-t border-line px-[20px]">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!hasData || isHistoryBusy || query.isError}
              className="flex h-[40px] items-center gap-[7px] rounded-[11px] bg-teal px-[18px] text-[13.5px] font-bold text-white hover:bg-teal-d disabled:opacity-40"
            >
              <PrinterIcon className="h-[16px] w-[16px]" />
              인쇄
            </button>
          </footer>
        </section>
      </div>

      {hasData && (
        <article className="hidden print:block" data-testid="villa-receipt-history-print-root">
          <h1 className="mb-3 text-center text-xl font-bold">{building.name} 빌라 수납내역</h1>
          <ReportTable model={model} />
        </article>
      )}
    </>
  );
}
