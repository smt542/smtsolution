"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { CloseIcon, PrinterIcon } from "@/components/icons";
import type { Building } from "@/hooks/reactquery/buildings";
import { useBuildingTypes } from "@/hooks/reactquery/buildingTypes";
import { useFeeItems } from "@/hooks/reactquery/feeItems";
import {
  getReceiptStatementData,
  receiptKeys,
  type ReceiptStatementData,
} from "@/hooks/reactquery/receipts";
import { useLateFeeRateTiers } from "@/hooks/reactquery/lateFeeTiers";
import type { RateTier } from "@/lib/billing/lateFee";
import { toMonthInput } from "@/lib/billing/period";
import { matchesBuildingGroup } from "@/lib/buildings/groupType";
import { AsyncContentState } from "../AsyncContentState";
import { lateFeeForRow } from "../paymentHistoryRows";
import { buildMonthlyReport, periodsBetween, shiftMonth } from "./buildMonthlyReport";
import { MonthlyChargeSummary } from "./MonthlyChargeSummary";
import { MonthlyChargeTable } from "./MonthlyChargeTable";
import { MonthlyChargeToolbar } from "./MonthlyChargeToolbar";
import { ChargeReportPrint } from "../print/ChargeReportPrint";

const monthDot = (month: string) => month.replace("-", ".");
const dayDot = (day: string) => (day ? day.replaceAll("-", ".") : "—");

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
  const [selectedBuildingTypeId, setSelectedBuildingTypeId] = useState<number | null>(null);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [printing, setPrinting] = useState(false);
  const { data: buildingTypes = [] } = useBuildingTypes();

  const handleClose = useCallback(() => {
    setPrinting(false);
    onClose();
  }, [onClose]);

  const buildingTypeOptions = useMemo(
    () =>
      [...buildingTypes]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((buildingType) => ({
          value: String(buildingType.id),
          label: buildingType.label,
        })),
    [buildingTypes],
  );
  // 정본처럼 '전체' 없이 첫 유형(sortOrder 순)이 기본이다.
  const effectiveBuildingTypeId =
    selectedBuildingTypeId ??
    (buildingTypeOptions[0] ? Number(buildingTypeOptions[0].value) : null);
  const feeItemsQuery = useFeeItems(open && effectiveBuildingTypeId !== null ? effectiveBuildingTypeId : 0);
  const reportBuildings = useMemo(
    () =>
      buildings.filter(
        (building) =>
          building.typeId === effectiveBuildingTypeId &&
          matchesBuildingGroup(building, selectedGroup),
      ),
    [buildings, effectiveBuildingTypeId, selectedGroup],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, handleClose]);

  const periods = useMemo(
    () => periodsBetween(appliedStart, appliedEnd),
    [appliedStart, appliedEnd],
  );

  const canLoad = open && reportBuildings.length > 0 && periods.length > 0;
  const queries = useQueries({
    queries: reportBuildings.map((building) => ({
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
      // 정본 #acCond·인쇄 .ac-meta 형식: 날짜는 YYYY.MM.DD, 비어 있는 쪽은 —, 둘 다 비면 전체.
      paymentDate:
        paymentStart || paymentEnd ? `${dayDot(paymentStart)} ~ ${dayDot(paymentEnd)}` : "전체",
    }),
    [appliedStart, appliedEnd, paymentStart, paymentEnd],
  );

  // 연체료는 수납 이력 표와 같은 요율표 계산을 쓴다(기준월 = 화면 기준월).
  const orgId = buildings[0]?.orgId ?? null;
  const { data: lateFeeRateTiers } = useLateFeeRateTiers(open ? orgId : null);
  const tiers = useMemo<RateTier[]>(
    () =>
      (lateFeeRateTiers ?? []).map((tier) => ({
        fromMonth: tier.fromMonth,
        toMonth: tier.toMonth,
        monthlyRate: tier.monthlyRate,
      })),
    [lateFeeRateTiers],
  );

  const model = useMemo(
    () =>
      buildMonthlyReport(canLoad ? statementData : undefined, periods, summaryMeta, {
        paymentStartDate: paymentStart || null,
        paymentEndDate: paymentEnd || null,
        configuredFeeItems: feeItemsQuery.data,
        lateFeeOf: (row) => lateFeeForRow(row.period, row, tiers, period),
      }),
    [canLoad, statementData, periods, summaryMeta, paymentStart, paymentEnd, feeItemsQuery.data, tiers, period],
  );

  if (!open) return null;

  const isReportInitialLoading = canLoad && queries.some((query) => query.isLoading);
  const isReportRefreshing = canLoad
    && queries.some((query) => query.isFetching && !query.isLoading);
  const isReportBusy = isReportInitialLoading || isReportRefreshing;
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
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-[24px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="monthly-charge-title"
        onClick={handleClose}
      >
        <div
          className="flex h-[720px] max-h-[calc(100vh-48px)] w-[1240px] max-w-[calc(100vw-48px)] flex-col overflow-clip rounded-[20px] bg-surface leading-[normal] shadow-[0px_30px_70px_-20px_rgba(0,0,0,0.4)]"
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
              onClick={handleClose}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] border border-line bg-surface text-t3 transition-[border-color,background] duration-[120ms] hover:border-[#C9D0D8] hover:bg-[#F7F9FA] hover:text-t2"
            >
              <CloseIcon className="h-[14px] w-[14px]" />
            </button>
          </div>

          {/* 필터 · 요약 */}
          <MonthlyChargeToolbar
            buildingTypeValue={effectiveBuildingTypeId === null ? "" : String(effectiveBuildingTypeId)}
            buildingTypeOptions={buildingTypeOptions}
            groupValue={selectedGroup}
            startMonth={pendingStart}
            endMonth={pendingEnd}
            paymentStart={paymentStart}
            paymentEnd={paymentEnd}
            onBuildingType={(value) => setSelectedBuildingTypeId(Number(value))}
            onGroup={setSelectedGroup}
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
            loading={isReportInitialLoading}
            loadingLabel="월별 부과·수납 자료 불러오는 중"
            refreshing={isReportRefreshing}
            refreshingLabel="월별 부과·수납 자료 갱신 중"
            empty={reportBuildings.length === 0 || !hasData}
            emptyMessage={
              reportBuildings.length === 0
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
              onClick={() => {
                if (printing) return;
                setPrinting(true);
              }}
              disabled={!hasData || isReportBusy || isError}
              className="flex h-[40px] items-center gap-[7px] rounded-[11px] bg-teal px-[14px] text-[13.5px] font-bold text-white hover:bg-teal-d disabled:opacity-40"
            >
              <PrinterIcon className="h-[16px] w-[16px]" />
              인쇄
            </button>
          </div>
        </div>
      </div>

      {open && printing && (
        <ChargeReportPrint
          variant="monthly"
          model={model}
          buildingName=""
          rangeLabel={model.summary.periodRange}
          paymentDayLabel={model.summary.paymentDate}
          onDone={() => setPrinting(false)}
        />
      )}
    </>
  );
}
