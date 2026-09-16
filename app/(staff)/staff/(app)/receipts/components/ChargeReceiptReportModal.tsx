"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarIcon, CloseIcon, PrinterIcon } from "@/components/icons";
import { DpDatePicker } from "@/components/common/DpDatePicker";
import { DpMonthPicker } from "@/components/common/DpMonthPicker";
import type { Building } from "@/hooks/reactquery/buildings";
import { useReceiptStatementData } from "@/hooks/reactquery/receipts";
import { toMonthInput } from "@/lib/billing/period";
import { AsyncContentState } from "./AsyncContentState";
import {
  buildChargeReport,
  periodsBetween,
  shiftMonth,
} from "./chargeReport/buildChargeReport";
import { ChargeReportInfoBar } from "./chargeReport/ChargeReportInfoBar";
import { ChargeReportPrintView } from "./chargeReport/ChargeReportPrintView";
import { ChargeReportTable } from "./chargeReport/ChargeReportTable";

const monthLabel = (month: string) => month.replace("-", ".");

export function ChargeReceiptReportModal({
  open,
  onClose,
  building,
  period,
}: {
  open: boolean;
  onClose: () => void;
  building: Building | null;
  period: string;
}) {
  const currentMonth = toMonthInput(period);
  const defaultStart = shiftMonth(currentMonth, -7);

  const [pendingStart, setPendingStart] = useState(defaultStart);
  const [pendingEnd, setPendingEnd] = useState(currentMonth);
  const [appliedStart, setAppliedStart] = useState(defaultStart);
  const [appliedEnd, setAppliedEnd] = useState(currentMonth);
  const [paymentStartDate, setPaymentStartDate] = useState("");
  const [paymentEndDate, setPaymentEndDate] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const periods = useMemo(
    () => periodsBetween(appliedStart, appliedEnd),
    [appliedStart, appliedEnd],
  );

  const canLoad = open && building !== null && periods.length > 0;
  const query = useReceiptStatementData(
    building?.id ?? 0,
    null,
    periods[0] ?? "",
    periods.at(-1) ?? "",
    canLoad,
  );

  const model = useMemo(
    () =>
      buildChargeReport(canLoad ? query.data : undefined, periods, {
        paymentStartDate: paymentStartDate || null,
        paymentEndDate: paymentEndDate || null,
      }),
    [canLoad, query.data, periods, paymentStartDate, paymentEndDate],
  );

  if (!open) return null;

  const isReportInitialLoading = canLoad && query.isLoading;
  const isReportRefreshing = canLoad && query.isFetching && !query.isLoading;
  const isReportBusy = isReportInitialLoading || isReportRefreshing;
  const isError = canLoad && query.isError;
  const hasData = Boolean(
    query.data &&
      (query.data.paymentRows.length > 0 ||
        query.data.payments.length > 0 ||
        query.data.documents.length > 0),
  );
  const buildingName = building?.name ?? "";
  const rangeLabel = `${monthLabel(appliedStart)} ~ ${monthLabel(appliedEnd)}`;
  const paymentDayLabel =
    paymentStartDate || paymentEndDate
      ? `${paymentStartDate || "…"} ~ ${paymentEndDate || "…"}`
      : "전체";

  const applySearch = () => {
    setAppliedStart(pendingStart > pendingEnd ? pendingEnd : pendingStart);
    setAppliedEnd(pendingEnd < pendingStart ? pendingStart : pendingEnd);
  };

  return (
    <>
      <style>{"@media print { @page { size: A4 landscape; margin: 8mm; } }"}</style>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim p-6 print:hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="charge-report-title"
        onClick={onClose}
      >
        <div
          className="flex h-[720px] max-h-[calc(100vh-48px)] w-[1240px] max-w-[calc(100vw-48px)] flex-col overflow-hidden rounded-[20px] bg-surface shadow-pop"
          onClick={(event) => event.stopPropagation()}
        >
          {/* 헤더 */}
          <header className="flex h-[61px] shrink-0 items-center border-b border-line px-[20px]">
            <h2
              id="charge-report-title"
              className="text-[16px] font-extrabold tracking-[-0.32px] text-t1"
            >
              빌라 부과금액
            </h2>
            <div className="flex-1" />
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] border border-line text-t2 hover:bg-bg"
            >
              <CloseIcon />
            </button>
          </header>

          {/* 본문 */}
          <div className="flex min-h-0 flex-1 flex-col">
            {/* 필터 */}
            <div className="flex shrink-0 flex-wrap items-center gap-[8px] border-b border-line px-[16px] py-[13px]">
              <span className="text-[12px] font-bold text-t3">기준월</span>
              <DpMonthPicker
                value={pendingStart}
                onChange={setPendingStart}
                ariaLabel="기준월 시작"
                placeholder="YYYY.MM"
                triggerClassName="flex h-[38px] w-[116px] cursor-pointer items-center rounded-[10px] border border-line bg-surface px-[10px] text-[12.5px] font-medium text-t1"
                triggerOpenClassName="border-teal"
                endAdornment={<CalendarIcon className="ml-auto size-[15px] shrink-0 text-t3" aria-hidden="true" />}
              />
              <span className="font-bold text-t4">~</span>
              <DpMonthPicker
                value={pendingEnd}
                onChange={setPendingEnd}
                ariaLabel="기준월 종료"
                placeholder="YYYY.MM"
                triggerClassName="flex h-[38px] w-[116px] cursor-pointer items-center rounded-[10px] border border-line bg-surface px-[10px] text-[12.5px] font-medium text-t1"
                triggerOpenClassName="border-teal"
                endAdornment={<CalendarIcon className="ml-auto size-[15px] shrink-0 text-t3" aria-hidden="true" />}
              />
              <span className="ml-[6px] text-[12px] font-bold text-t3">수납일</span>
              <DpDatePicker
                value={paymentStartDate}
                onChange={setPaymentStartDate}
                ariaLabel="수납일 시작"
                placeholder="시작일"
                triggerClassName="flex h-[38px] w-[116px] cursor-pointer items-center rounded-[10px] border border-line bg-surface px-[10px] text-[12.5px] font-medium text-t1"
                triggerOpenClassName="border-teal"
                endAdornment={<CalendarIcon className="ml-auto size-[15px] shrink-0 text-t3" aria-hidden="true" />}
              />
              <span className="font-bold text-t4">~</span>
              <DpDatePicker
                value={paymentEndDate}
                onChange={setPaymentEndDate}
                ariaLabel="수납일 종료"
                placeholder="종료일"
                triggerClassName="flex h-[38px] w-[116px] cursor-pointer items-center rounded-[10px] border border-line bg-surface px-[10px] text-[12.5px] font-medium text-t1"
                triggerOpenClassName="border-teal"
                endAdornment={<CalendarIcon className="ml-auto size-[15px] shrink-0 text-t3" aria-hidden="true" />}
              />
              <div className="flex-1" />
              <button
                type="button"
                onClick={applySearch}
                className="h-[38px] rounded-[11px] bg-teal px-[15px] text-[13.5px] font-bold text-white hover:bg-teal-d"
              >
                검색
              </button>
            </div>

            {/* 표 제목 + 요약 */}
            <div className="flex shrink-0 flex-col border-b border-line px-[16px] pb-[13px] pt-[15px]">
              <p className="text-center text-[15px] font-bold tracking-[-0.3px] text-t1">
                [ {buildingName || "건물"} 부과금액 및 수납자료 ]
              </p>
              <ChargeReportInfoBar
                rangeLabel={rangeLabel}
                paymentDayLabel={paymentDayLabel}
                totalPaid={model.totals.paid}
                totalLateFee={model.totals.lateFee}
                totalFee={model.totals.fee}
                totalNetPaid={model.totals.netPaid}
              />
            </div>

            {/* 테이블 */}
            <AsyncContentState
              error={isError}
              errorMessage="부과·수납 자료를 불러오지 못했습니다."
              loading={isReportInitialLoading}
              loadingLabel="부과·수납 자료 불러오는 중"
              refreshing={isReportRefreshing}
              refreshingLabel="부과·수납 자료 갱신 중"
              empty={building === null || !hasData}
              emptyMessage={
                building === null ? "건물을 먼저 선택하세요" : "조회된 부과·수납 자료가 없습니다."
              }
            >
              <ChargeReportTable model={model} />
            </AsyncContentState>
          </div>

          {/* 푸터 */}
          <footer className="flex shrink-0 items-center justify-end border-t border-line px-[20px] py-[14px]">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!hasData || isReportBusy || isError}
              className="flex h-[40px] items-center gap-[7px] rounded-[11px] bg-teal px-[18px] text-[13.5px] font-bold text-white hover:bg-teal-d disabled:opacity-40"
            >
              <PrinterIcon />
              인쇄
            </button>
          </footer>
        </div>
      </div>

      {hasData && (
        <div className="hidden print:block" data-testid="charge-report-print-root">
          <ChargeReportPrintView model={model} buildingName={buildingName} rangeLabel={rangeLabel} />
        </div>
      )}
    </>
  );
}
