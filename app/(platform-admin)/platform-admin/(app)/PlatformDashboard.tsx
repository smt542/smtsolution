"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, Spinner } from "@/components/common";
import { DpMonthPicker } from "@/components/common/DpMonthPicker";
import {
  usePlatformOrgBilling,
  usePlatformOverviewMetrics,
} from "@/hooks/reactquery/platform";
import { formatNumber } from "@/lib/format";
import { PlatformPagination, QueryError } from "../../_components/PageElements";
import { PlatformPageContainer } from "../../_components/PlatformPageContainer";
import { MonthlySendCostChart } from "../_components/MonthlySendCostChart";

const num = (n: number) => formatNumber(n);
const PAGE_SIZE = 6;

function currentMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthLabel(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  return `${year}년 ${month}월`;
}

function signed(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${num(Math.abs(n))}`;
}

export function PlatformDashboard() {
  const [currentMonth] = useState(currentMonthIso);
  const [month, setMonth] = useState(currentMonth);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const metricsQuery = usePlatformOverviewMetrics(currentMonth);
  const billingQuery = usePlatformOrgBilling(month);

  // 정본 fitPer: 패널 남는 높이에 들어가는 만큼 한 쪽 행 수(최소 3). lg 미만(1열)은 6행 고정.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const measurePageSize = () => {
      const head = scroller.querySelector("thead");
      const row = scroller.querySelector("tbody tr");
      if (!head || !row) return;

      if (window.getComputedStyle(scroller).position !== "absolute") {
        setPageSize((current) => current === PAGE_SIZE ? current : PAGE_SIZE);
        return;
      }

      const headerHeight = head.getBoundingClientRect().height;
      const rowHeight = row.getBoundingClientRect().height || 41;
      const nextPageSize = Math.max(
        3,
        Math.floor((scroller.clientHeight - headerHeight) / rowHeight),
      );
      setPageSize((current) => current === nextPageSize ? current : nextPageSize);
    };

    const observer = new ResizeObserver(measurePageSize);
    observer.observe(scroller);
    const frame = requestAnimationFrame(measurePageSize);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [billingQuery.data]);

  const metrics = metricsQuery.data;
  const appRate = metrics && metrics.unitCount > 0
    ? Math.round((metrics.linkedUnitCount / metrics.unitCount) * 100)
    : 0;
  const costDelta = metrics ? metrics.sendCostKrw - metrics.sendCostPrevKrw : 0;

  const tenantRows = useMemo(
    () => billingQuery.data ?? [],
    [billingQuery.data],
  );
  const totalPages = Math.max(1, Math.ceil(tenantRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = tenantRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <PlatformPageContainer
      maxWidthClassName="max-w-none"
      paddingClassName="flex flex-col gap-4 px-6 pb-[30px] pt-[22px]"
    >
      <section aria-label="핵심 지표">
        {metricsQuery.isPending ? (
          <div className="rounded-2xl bg-surface py-16"><Spinner /></div>
        ) : metricsQuery.isError || !metrics ? (
          <QueryError onRetry={() => void metricsQuery.refetch()} />
        ) : (
          <div className="grid gap-[13px] sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="계약 업체"
              value={num(metrics.orgActive)}
              unit="곳"
              sub={`정지 ${num(metrics.orgSuspended)} · 해지 ${num(metrics.orgTerminated)}`}
            />
            <KpiCard
              label="관리 건물"
              value={num(metrics.buildingCount)}
              unit="곳"
              sub={
                <>
                  이번 달 <em className="not-italic text-blue">+{num(metrics.buildingAddedThisMonth)}곳</em>
                </>
              }
            />
            <KpiCard
              label="총 입주자"
              value={num(metrics.unitCount)}
              unit="세대"
              sub={`앱 연결 ${num(metrics.linkedUnitCount)}세대 (${appRate}%)`}
            />
            <KpiCard
              label={`${monthLabel(currentMonth).split(" ")[1]} 발송 비용`}
              value={num(metrics.sendCostKrw)}
              unit="원"
              sub={
                <>
                  전월 대비{" "}
                  <em className={`not-italic ${costDelta < 0 ? "text-red" : "text-blue"}`}>
                    {signed(costDelta)}원
                  </em>
                </>
              }
            />
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1.5fr_1fr]">
        <MonthlySendCostChart />

        <section aria-label="테넌트별 발송 비용" className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-surface shadow-card">
          <div className="flex items-center gap-2.5 border-b border-line2 px-[18px] py-[15px]">
            <h3 className="flex-1 text-[15px] font-extrabold text-t1">테넌트별 발송 비용</h3>
            <DpMonthPicker
              value={month.slice(0, 7)}
              onChange={(nextMonth) => {
                setMonth(`${nextMonth}-01`);
                setPage(1);
              }}
              variant="hq"
              align="end"
              minMonth="2025-01"
              maxMonth={currentMonth.slice(0, 7)}
              ariaLabel="발송 비용 조회 월"
            />
          </div>
          <div className="relative min-h-0 flex-1">
            <div ref={scrollerRef} className="overflow-auto lg:absolute lg:inset-0">
              {billingQuery.isPending ? (
                <div className="py-16"><Spinner /></div>
              ) : billingQuery.isError ? (
                <div className="p-4">
                  <QueryError onRetry={() => void billingQuery.refetch()} />
                </div>
              ) : tenantRows.length === 0 ? (
                <EmptyState message="조회 가능한 업체가 없습니다" />
              ) : (
                <table className="w-full border-collapse leading-[normal]">
                  <thead>
                    <tr>
                      <th className="border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-left text-[12px] font-bold text-t3 whitespace-nowrap">업체명</th>
                      <th className="border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-right text-[12px] font-bold text-t3 whitespace-nowrap">알림톡</th>
                      <th className="border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-right text-[12px] font-bold text-t3 whitespace-nowrap">문자</th>
                      <th className="border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-right text-[12px] font-bold text-t3 whitespace-nowrap">팩스</th>
                      <th className="border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-right text-[12px] font-bold text-t3 whitespace-nowrap">합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((row) => (
                      <tr key={row.orgId} className="hover:bg-row-hover [&:last-child>td]:border-b-0">
                        <td className="break-keep border-b border-line2 px-4 py-3 text-[13.5px] font-bold text-t1 whitespace-normal">{row.orgName}</td>
                        <td className="border-b border-line2 px-4 py-3 text-right text-[13.5px] text-t1 whitespace-nowrap num">
                          {num(row.alimtalkAmountKrw)}
                        </td>
                        <td className="border-b border-line2 px-4 py-3 text-right text-[13.5px] text-t1 whitespace-nowrap num">
                          {num(row.smsAmountKrw)}
                        </td>
                        <td className="border-b border-line2 px-4 py-3 text-right text-[13.5px] text-t1 whitespace-nowrap num">
                          {num(row.faxAmountKrw)}
                        </td>
                        <td className="border-b border-line2 px-4 py-3 text-right text-[13.5px] font-extrabold text-t1 whitespace-nowrap num">{num(row.subtotalKrw)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          {!billingQuery.isPending
            && !billingQuery.isError
            && (
              <PlatformPagination
                page={currentPage}
                pageSize={pageSize}
                totalCount={tenantRows.length}
                onPageChange={setPage}
                numeric
                compact
                totalLabel={`전체 ${num(tenantRows.length)}곳`}
              />
            )}
        </section>
      </div>
    </PlatformPageContainer>
  );
}

// 정본 admin/overview .hq-k: 텍스트 전용(아이콘 없음) — label 12.5/t3, value 26/-.03em + 작은 단위, sub 12/t3(컬러 델타).
function KpiCard({ label, value, unit, sub }: { label: string; value: string; unit: string; sub: ReactNode }) {
  return (
    <article className="rounded-[15px] bg-surface px-[18px] py-[17px] shadow-card">
      <div className="text-[12.5px] font-bold text-t3">{label}</div>
      <div className="mt-[9px] whitespace-nowrap text-[26px] font-extrabold tracking-[-0.03em] text-t1 num">
        {value}
        <small className="ml-[3px] text-[14px] font-bold tracking-normal text-t3">{unit}</small>
      </div>
      <div className="mt-[7px] truncate text-[12px] font-bold text-t3 num">{sub}</div>
    </article>
  );
}
