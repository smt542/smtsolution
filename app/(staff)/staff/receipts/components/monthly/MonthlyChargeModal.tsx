"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { CloseIcon, PrinterIcon } from "@/components/icons";
import type { Building } from "@/hooks/reactquery/buildings";
import {
  getReceiptStatementData,
  receiptKeys,
  type ReceiptStatementData,
} from "@/hooks/reactquery/receipts";
import { toMonthInput } from "@/lib/billing/period";
import { AsyncContentState } from "../AsyncContentState";
import { buildMonthlyReport, periodsBetween, shiftMonth } from "./buildMonthlyReport";
import { MonthlyChargeSummary } from "./MonthlyChargeSummary";
import { MonthlyChargeTable } from "./MonthlyChargeTable";
import { MonthlyChargeToolbar } from "./MonthlyChargeToolbar";

const monthDot = (month: string) => month.replace("-", ".");

// "월별 부과금액" 리포트 모달 (Figma 시안 픽셀 재현 + 실데이터 배선).
// 오케스트레이터: 오버레이 + Esc/스크롤락 + 필터 상태 + 데이터 집계, 조각은 import해 조립.
export function MonthlyChargeModal({
  open,
  onClose,
  buildings,
  period,
}: {
  open: boolean;
  onClose: () => void;
  buildings: Building[];
  period: string;
}) {
  const currentMonth = toMonthInput(period);
  const defaultStart = shiftMonth(currentMonth, -7);

  const [pendingStart, setPendingStart] = useState(defaultStart);
  const [pendingEnd, setPendingEnd] = useState(currentMonth);
  const [appliedStart, setAppliedStart] = useState(defaultStart);
  const [appliedEnd, setAppliedEnd] = useState(currentMonth);
  const [paymentStart, setPaymentStart] = useState("");
  const [paymentEnd, setPaymentEnd] = useState("");

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

  const canLoad = open && buildings.length > 0 && periods.length > 0;
  const queries = useQueries({
    queries: buildings.map((building) => ({
      queryKey: receiptKeys.statement(
        building.id,
        null,
        periods[0] ?? "",
        periods.at(-1) ?? "",
      ),
      queryFn: () =>
        getReceiptStatementData(
          building.id,
          null,
          periods[0] ?? "",
          periods.at(-1) ?? "",
        ),
      enabled: canLoad,
    })),
  });

  const statementData = useMemo<ReceiptStatementData>(
    () => ({
      paymentRows: queries.flatMap((query) => query.data?.paymentRows ?? []),
      payments: queries.flatMap((query) => query.data?.payments ?? []),
      documents: queries.flatMap((query) => query.data?.documents ?? []),
      utilities: {
        electricity: queries.flatMap((query) => query.data?.utilities.electricity ?? []),
        water: queries.flatMap((query) => query.data?.utilities.water ?? []),
        gas: queries.flatMap((query) => query.data?.utilities.gas ?? []),
      },
    }),
    [queries],
  );

  const summaryMeta = useMemo(
    () => ({
      periodRange: `${monthDot(appliedStart)} ~ ${monthDot(appliedEnd)}`,
      paymentDate:
        paymentStart || paymentEnd ? `${paymentStart || "…"} ~ ${paymentEnd || "…"}` : "전체",
    }),
    [appliedStart, appliedEnd, paymentStart, paymentEnd],
  );

  const model = useMemo(
    () =>
      buildMonthlyReport(canLoad ? statementData : undefined, periods, summaryMeta, {
        paymentStartDate: paymentStart || null,
        paymentEndDate: paymentEnd || null,
      }),
    [canLoad, statementData, periods, summaryMeta, paymentStart, paymentEnd],
  );

  if (!open) return null;

  const isLoading = canLoad && queries.some((query) => query.isLoading || query.isFetching);
  const isError = canLoad && queries.some((query) => query.isError);
  const hasData = Boolean(
    statementData.paymentRows.length > 0 ||
      statementData.payments.length > 0 ||
      statementData.documents.length > 0,
  );
  const title = "[ 월별 총 부과금액 및 수납자료 ]";

  const applySearch = () => {
    setAppliedStart(pendingStart > pendingEnd ? pendingEnd : pendingStart);
    setAppliedEnd(pendingEnd < pendingStart ? pendingStart : pendingEnd);
  };

  return (
    <>
      <style>{"@media print { @page { size: A4 landscape; margin: 8mm; } }"}</style>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(23,31,40,0.45)] p-[24px] print:hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="monthly-charge-title"
        onClick={onClose}
      >
        <div
          className="flex h-[720px] max-h-[calc(100vh-48px)] w-[1240px] max-w-[calc(100vw-48px)] flex-col overflow-clip rounded-[20px] bg-surface shadow-[0px_30px_70px_-20px_rgba(0,0,0,0.4)]"
          onClick={(event) => event.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex w-full shrink-0 items-center gap-[10px] border-b border-line px-[20px] py-[17px]">
            <p id="monthly-charge-title" className="text-[16px] font-extrabold tracking-[-0.32px] text-t1">
              월별 부과금액
            </p>
            <div className="flex-1" />
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border border-line bg-surface text-t3 hover:bg-bg"
            >
              <CloseIcon className="h-[14px] w-[14px]" />
            </button>
          </div>

          {/* 필터 · 요약 */}
          <MonthlyChargeToolbar
            buildingTypeLabel="빌라"
            groupLabel="전체"
            startMonth={pendingStart}
            endMonth={pendingEnd}
            paymentStart={paymentStart}
            paymentEnd={paymentEnd}
            onStartMonth={setPendingStart}
            onEndMonth={setPendingEnd}
            onPaymentStart={setPaymentStart}
            onPaymentEnd={setPaymentEnd}
            onSearch={applySearch}
          />
          <MonthlyChargeSummary title={title} summary={model.summary} />

          {/* 표 (세로·가로 스크롤) */}
          <AsyncContentState
            error={isError}
            errorMessage="부과·수납 자료를 불러오지 못했습니다."
            loading={isLoading}
            empty={buildings.length === 0 || !hasData}
            emptyMessage={
              buildings.length === 0
                ? "조회 가능한 건물이 없습니다."
                : "조회된 부과·수납 자료가 없습니다."
            }
          >
            <MonthlyChargeTable model={model} />
          </AsyncContentState>

          {/* 푸터: 인쇄 */}
          <div className="flex h-[69px] shrink-0 items-center justify-end border-t border-line px-[20px]">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!hasData || isLoading || isError}
              className="flex h-[40px] items-center gap-[6px] rounded-[11px] bg-teal px-[14px] text-[13.5px] font-bold text-white hover:bg-teal-d disabled:opacity-40"
            >
              <PrinterIcon className="h-[16px] w-[16px]" />
              인쇄
            </button>
          </div>
        </div>
      </div>

      {hasData && (
        <div className="hidden print:block" data-testid="monthly-charge-print-root">
          <div className="mx-auto w-max bg-white p-[10mm] text-black">
            <p className="mb-2 text-center text-[15px] font-bold">{title}</p>
            <p className="mb-3 text-center text-[11px]">기준월 · {summaryMeta.periodRange}</p>
            <MonthlyChargeTable model={model} />
          </div>
        </div>
      )}
    </>
  );
}
