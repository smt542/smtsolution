"use client";

import { useEffect, useMemo, useState } from "react";
import { CloseIcon, PrinterIcon } from "@/components/icons";
import type { Building } from "@/hooks/reactquery/buildings";
import { useReceiptStatementData } from "@/hooks/reactquery/receipts";
import { formatNumber } from "@/lib/format";
import { AsyncContentState } from "../AsyncContentState";
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

const gridClass =
  "grid grid-cols-[64px_154px_144px_78px_178px_148px_64px_44px_minmax(214px,1fr)]";

function ReportTable({ model }: { model: VillaReceiptReportModel }) {
  return (
    <div className="min-w-[1120px] text-[13px] text-t1">
      <div
        className={`${gridClass} sticky top-0 z-10 h-[37px] items-center border-b border-line bg-[#f7f9fa] px-[16px] text-[11.5px] font-medium text-t3`}
      >
        <span>호수</span>
        <span>년월</span>
        <span className="text-right">당월계</span>
        <span className="text-right">수납액</span>
        <span className="pl-[18px]">수납일자</span>
        <span>은행</span>
        <span>chk</span>
        <span>C</span>
        <span>비고</span>
      </div>
      {model.rows.map((row) => (
        <div
          key={row.key}
          className={`${gridClass} h-[41px] items-center border-b border-line2 px-[16px] font-medium tabular-nums`}
        >
          <span>{row.unitLabel}</span>
          <span>{row.periodLabel}</span>
          <span className="text-right">{formatNumber(row.charged)}</span>
          <span className="text-right">{formatNumber(row.paid)}</span>
          <span className="pl-[18px]">{row.paidAtLabel}</span>
          <span>{row.methodLabel}</span>
          <span>{row.kindLabel}</span>
          <span />
          <span className="truncate" title={row.memo}>{row.memo}</span>
        </div>
      ))}
      <div
        className={`${gridClass} h-[41px] items-center border-t border-line bg-[#f7f9fa] px-[16px] font-medium tabular-nums`}
      >
        <span>합계</span>
        <span />
        <span className="text-right">{formatNumber(model.totals.charged)}</span>
        <span className="text-right">{formatNumber(model.totals.paid)}</span>
      </div>
    </div>
  );
}

function SelectField({
  value,
  onChange,
  ariaLabel,
  children,
}: {
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-[32px] rounded-[9px] border border-line bg-surface px-[11px] text-[13px] font-bold text-t1 outline-none focus:border-teal"
    >
      {children}
    </select>
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

  const years = Array.from({ length: 11 }, (_, index) => initialYear - 5 + index);
  const isLoading = query.isLoading || query.isFetching;
  const hasData = model.rows.length > 0;

  return (
    <>
      <style>{"@media print { @page { size: A4 landscape; margin: 8mm; } }"}</style>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-[#171f28]/45 p-6 print:hidden"
        onClick={onClose}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="villa-receipt-history-title"
          className="flex h-[700px] max-h-[calc(100vh-48px)] w-[1120px] max-w-[calc(100vw-48px)] flex-col overflow-hidden rounded-[20px] bg-surface shadow-pop"
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
              className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] border border-line text-t3 hover:bg-bg"
            >
              <CloseIcon className="h-[14px] w-[14px]" />
            </button>
          </header>

          <div className="flex h-[59px] shrink-0 items-center gap-[8px] border-b border-line px-[16px]">
            <SelectField value={startYear} onChange={setStartYear} ariaLabel="시작 연도">
              {years.map((year) => <option key={year} value={year}>{year}년</option>)}
            </SelectField>
            <SelectField value={startMonth} onChange={setStartMonth} ariaLabel="시작 월">
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <option key={month} value={month}>{month}월</option>
              ))}
            </SelectField>
            <span className="text-t4">~</span>
            <SelectField value={endYear} onChange={setEndYear} ariaLabel="종료 연도">
              {years.map((year) => <option key={year} value={year}>{year}년</option>)}
            </SelectField>
            <SelectField value={endMonth} onChange={setEndMonth} ariaLabel="종료 월">
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <option key={month} value={month}>{month}월</option>
              ))}
            </SelectField>
            <div className="flex-1" />
            <div className="flex rounded-[10px] bg-bg p-[2px] text-[12px] font-bold">
              {(["all", "paid"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScope(value)}
                  className={`h-[28px] rounded-[8px] px-[13px] ${scope === value ? "bg-surface text-t1 shadow-sm" : "text-t4"}`}
                >
                  {value === "all" ? "전체" : "수납"}
                </button>
              ))}
            </div>
          </div>

          <AsyncContentState
            error={query.isError}
            errorMessage="수납내역을 불러오지 못했습니다."
            loading={isLoading}
            empty={periods.length === 0 || !hasData}
            emptyMessage={
              periods.length === 0 ? "조회 기간을 확인하세요." : "조회된 수납내역이 없습니다."
            }
          >
            <ReportTable model={model} />
          </AsyncContentState>

          <footer className="flex h-[69px] shrink-0 items-center justify-end border-t border-line px-[20px]">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!hasData || isLoading || query.isError}
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
