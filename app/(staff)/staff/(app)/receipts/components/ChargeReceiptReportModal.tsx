"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/common/Button";
import { CloseIcon, PrinterIcon } from "@/components/icons";
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
import { ChargeReportTable } from "./chargeReport/ChargeReportTable";
import { ChargeReportPrint } from "./print/ChargeReportPrint";
import { ReportDateField } from "./report-controls/ReportDateField";

const monthLabel = (month: string) => month.replace("-", ".");
const dayLabel = (day: string) => (day ? day.replaceAll("-", ".") : "—");

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
  const [printing, setPrinting] = useState(false);

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
  // 정본 #acCond·인쇄 .ac-meta 형식: 날짜는 YYYY.MM.DD, 비어 있는 쪽은 —, 둘 다 비면 전체.
  const paymentDayLabel =
    paymentStartDate || paymentEndDate
      ? `${dayLabel(paymentStartDate)} ~ ${dayLabel(paymentEndDate)}`
      : "전체";

  const applySearch = () => {
    setAppliedStart(pendingStart > pendingEnd ? pendingEnd : pendingStart);
    setAppliedEnd(pendingEnd < pendingStart ? pendingStart : pendingEnd);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="charge-report-title"
        onClick={onClose}
      >
        <div
          className="flex h-[720px] max-h-[calc(100vh-48px)] w-[1240px] max-w-[calc(100vw-48px)] flex-col overflow-hidden rounded-[20px] bg-surface leading-[normal] shadow-pop"
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
              className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] border border-line bg-surface text-t3 transition-[border-color,background] duration-[120ms] hover:border-[#C9D0D8] hover:bg-[#F7F9FA] hover:text-t2"
            >
              <CloseIcon />
            </button>
          </header>

          {/* 본문 */}
          <div className="flex min-h-0 flex-1 flex-col">
            {/* 필터 */}
            <div className="flex shrink-0 items-center gap-[8px] border-b border-line bg-white px-[16px] py-[13px]">
              <span className="text-[12px] font-bold text-t3">기준월</span>
              <ReportDateField
                type="month"
                value={pendingStart}
                ariaLabel="기준월 시작"
                onValueChange={setPendingStart}
                max={pendingEnd}
              />
              <span className="text-[12px] font-bold text-t3">~</span>
              <ReportDateField
                type="month"
                value={pendingEnd}
                ariaLabel="기준월 종료"
                onValueChange={setPendingEnd}
                min={pendingStart}
              />
              <span className="ml-[6px] text-[12px] font-bold text-t3">수납일</span>
              <ReportDateField
                type="date"
                value={paymentStartDate}
                ariaLabel="수납일 시작"
                placeholder="시작일"
                onValueChange={setPaymentStartDate}
                max={paymentEndDate || undefined}
              />
              <span className="text-[12px] font-bold text-t3">~</span>
              <ReportDateField
                type="date"
                value={paymentEndDate}
                ariaLabel="수납일 종료"
                placeholder="종료일"
                onValueChange={setPaymentEndDate}
                min={paymentStartDate || undefined}
              />
              <div className="flex-1" />
              <Button
                type="button"
                size="md"
                onClick={applySearch}
                className="shadow-none"
              >
                검색
              </Button>
            </div>

            {/* 표 제목 + 요약 */}
            <ChargeReportInfoBar
              buildingName={buildingName}
              rangeLabel={rangeLabel}
              paymentDayLabel={paymentDayLabel}
              totalPaid={model.totals.paid}
              totalLateFee={model.totals.lateFee}
              totalFee={model.totals.fee}
              totalNetPaid={model.totals.netPaid}
            />

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
                building === null ? "건물을 선택해 주세요" : "조회된 부과·수납 자료가 없습니다."
              }
            >
              <ChargeReportTable model={model} />
            </AsyncContentState>
          </div>

          {/* 푸터 */}
          <footer className="flex shrink-0 items-center justify-end border-t border-line px-[20px] py-[14px]">
            <button
              type="button"
              onClick={() => {
                if (printing) return;
                setPrinting(true);
              }}
              disabled={!hasData || isReportBusy || isError}
              className="flex h-[40px] items-center gap-[7px] rounded-[11px] bg-teal px-[18px] text-[13.5px] font-bold text-white hover:bg-teal-d disabled:opacity-40"
            >
              <PrinterIcon />
              인쇄
            </button>
          </footer>
        </div>
      </div>

      {printing && (
        <ChargeReportPrint
          variant="building"
          model={model}
          buildingName={buildingName}
          rangeLabel={rangeLabel}
          paymentDayLabel={paymentDayLabel}
          onDone={() => setPrinting(false)}
        />
      )}
    </>
  );
}
