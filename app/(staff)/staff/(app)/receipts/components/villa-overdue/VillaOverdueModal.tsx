"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CloseIcon, PrinterIcon } from "@/components/icons";
import type { Building } from "@/hooks/reactquery/buildings";
import {
  type OverdueScope,
  useOverdueHouseholds,
  useOverduePeriods,
} from "@/hooks/reactquery/overdue";
import { useLateFeeRateTiers } from "@/hooks/reactquery/lateFeeTiers";
import { AsyncContentState } from "../AsyncContentState";
import {
  buildOverdueGroups,
  grandTotals,
  toDisplayGroups,
  type OverdueLineOverride,
} from "./buildOverdueGroups";
import { OverdueDetailTable } from "./OverdueDetailTable";
import { OverdueFilterBar } from "./OverdueFilterBar";
import { OverdueTotalsBar } from "./OverdueTotalsBar";
import { VillaOverduePrintView } from "./VillaOverduePrintView";
import { padMonthCount } from "./format";

/**
 * 빌라 미납내역 — 동호·부과월별 미납원금 + 연체료 내역 조회/인쇄 모달 (Figma 673:21715).
 * 건물·부과월은 상위 수납관리 셸에서 선택된 값을 사용한다.
 */
export function VillaOverdueModal({
  open,
  onClose,
  building,
  orgId,
  period,
}: {
  open: boolean;
  onClose: () => void;
  building: Building;
  orgId: number;
  period: string;
}) {
  const [year, setYear] = useState(() => Number(period.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(period.slice(5, 7)));
  const [minOverdue, setMinOverdue] = useState(0);
  const [scope, setScope] = useState<OverdueScope>("all");
  const [overrides, setOverrides] = useState<Record<string, OverdueLineOverride>>({});

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

  const periodsQuery = useOverduePeriods(open ? building.id : null, { year, month, scope });
  const householdsQuery = useOverdueHouseholds(open ? building.id : null, { year, month, scope });
  const tiersQuery = useLateFeeRateTiers(open ? orgId : null);

  const seedGroups = useMemo(
    () =>
      buildOverdueGroups(
        periodsQuery.data ?? [],
        householdsQuery.data ?? [],
        tiersQuery.data ?? [],
        { year, month },
      ),
    [periodsQuery.data, householdsQuery.data, tiersQuery.data, year, month],
  );

  const filteredSeeds = useMemo(() => {
    if (minOverdue <= 0) return seedGroups;
    return seedGroups
      .map((group) => ({
        ...group,
        lines: group.lines.filter((line) => line.overdueMonths >= minOverdue),
      }))
      .filter((group) => group.lines.length > 0);
  }, [seedGroups, minOverdue]);

  const displayGroups = useMemo(
    () => toDisplayGroups(filteredSeeds, overrides),
    [filteredSeeds, overrides],
  );
  const totals = useMemo(() => grandTotals(displayGroups), [displayGroups]);

  const onEdit = useCallback((key: string, patch: OverdueLineOverride) => {
    setOverrides((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }, []);

  if (!open) return null;

  const isReportInitialLoading =
    periodsQuery.isLoading || householdsQuery.isLoading || tiersQuery.isLoading;
  const isReportRefreshing = [periodsQuery, householdsQuery, tiersQuery]
    .some((query) => query.isFetching && !query.isLoading);
  const isReportBusy = isReportInitialLoading || isReportRefreshing;
  const isError = periodsQuery.isError || householdsQuery.isError || tiersQuery.isError;
  const hasData = displayGroups.length > 0;
  const asOfLabel = `${year}/${padMonthCount(month)} 까지`;
  const scopeLabel = scope === "all" ? "전체" : "당월";

  return (
    <>
      <style>{"@media print { @page { size: A4 landscape; margin: 8mm; } }"}</style>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim p-6 print:hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="villa-overdue-title"
        onClick={onClose}
      >
        <div
          className="flex h-[700px] max-h-[calc(100vh-48px)] w-[1180px] max-w-[calc(100vw-48px)] flex-col overflow-hidden rounded-[20px] bg-surface leading-[normal] shadow-pop"
          onClick={(event) => event.stopPropagation()}
        >
          {/* 헤더 */}
          <header className="flex h-[61px] shrink-0 items-center border-b border-line px-[20px]">
            <h2
              id="villa-overdue-title"
              className="text-[16px] font-extrabold tracking-[-0.32px] text-t1"
            >
              빌라 미납내역
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

          {/* 필터 */}
          <OverdueFilterBar
            year={year}
            month={month}
            minOverdue={minOverdue}
            scope={scope}
            onYear={setYear}
            onMonth={setMonth}
            onMinOverdue={setMinOverdue}
            onScope={setScope}
          />

          {/* 테이블 */}
          <AsyncContentState
            error={isError}
            errorMessage="미납내역을 불러오지 못했습니다."
            loading={isReportInitialLoading}
            loadingLabel="미납내역 불러오는 중"
            refreshing={isReportRefreshing}
            refreshingLabel="미납내역 갱신 중"
            empty={!hasData}
            emptyMessage="조회된 미납내역이 없습니다."
          >
            <OverdueDetailTable
              groups={displayGroups}
              billerName={building.name}
              onEdit={onEdit}
            />
          </AsyncContentState>

          {/* 푸터: 총계 + 인쇄 */}
          <footer className="flex h-[69px] shrink-0 items-center justify-between gap-[16px] border-t border-line px-[20px]">
            <OverdueTotalsBar totals={totals} />
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!hasData || isReportBusy || isError}
              className="flex h-[40px] shrink-0 items-center gap-[7px] rounded-[11px] bg-teal px-[18px] text-[13.5px] font-bold text-white hover:bg-teal-d disabled:opacity-40"
            >
              <PrinterIcon />
              인쇄
            </button>
          </footer>
        </div>
      </div>

      {hasData && (
        <div className="hidden print:block" data-testid="villa-overdue-print-root">
          <VillaOverduePrintView
            groups={displayGroups}
            totals={totals}
            buildingName={building.name}
            billerName={building.name}
            asOfLabel={asOfLabel}
            scopeLabel={scopeLabel}
          />
        </div>
      )}
    </>
  );
}
