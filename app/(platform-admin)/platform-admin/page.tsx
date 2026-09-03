"use client";

import { type ReactNode, useMemo, useState } from "react";
import { EmptyState, Spinner } from "@/components/common";
import {
  usePlatformOrgBilling,
  usePlatformOverviewMetrics,
} from "@/hooks/reactquery/platform";
import { formatNumber } from "@/lib/format";
import {
  BoundedMonthStepper,
  DataScopeNotice,
  PageHeader,
  PlatformPagination,
  QueryError,
} from "../_components/PageElements";
import { PlatformPageContainer } from "../_components/PlatformPageContainer";
import { TableFrame } from "../_components/TableFrame";
import { MonthlySendCostChart } from "./_components/MonthlySendCostChart";

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

export default function PlatformDashboardPage() {
  const [month, setMonth] = useState(currentMonthIso);
  const [page, setPage] = useState(1);
  const metricsQuery = usePlatformOverviewMetrics(month);
  const billingQuery = usePlatformOrgBilling(month);

  const metrics = metricsQuery.data;
  const appRate = metrics && metrics.unitCount > 0
    ? Math.round((metrics.linkedUnitCount / metrics.unitCount) * 100)
    : 0;
  const costDelta = metrics ? metrics.sendCostKrw - metrics.sendCostPrevKrw : 0;

  const tenantRows = useMemo(
    () => billingQuery.data ?? [],
    [billingQuery.data],
  );
  const totalPages = Math.max(1, Math.ceil(tenantRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = tenantRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <PlatformPageContainer>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          eyebrow="HQ CONSOLE"
          title="대시보드"
          description="계약 업체·관리 건물·입주자 앱 연결과 월 발송 비용을 한눈에 확인합니다."
        />
        <BoundedMonthStepper
          month={month}
          onChange={(nextMonth) => {
            setMonth(nextMonth);
            setPage(1);
          }}
        />
      </div>

      <div className="mt-5">
        <DataScopeNotice />
      </div>

      <section className="mt-6" aria-label="핵심 지표">
        {metricsQuery.isPending ? (
          <div className="rounded-2xl bg-white py-16"><Spinner /></div>
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
              label={`${monthLabel(month).split(" ")[1]} 발송 비용`}
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

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4 items-stretch">
        <MonthlySendCostChart />

        <section aria-label="테넌트별 발송 비용" className="rounded-2xl bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-line2 px-[18px] py-[15px]">
            <div>
              <h3 className="text-[15px] font-extrabold text-t1">테넌트별 발송 비용</h3>
              <p className="mt-1 text-xs text-t3">{monthLabel(month)} · 채널별 공급가액 (부가세 제외)</p>
            </div>
          </div>
          {billingQuery.isPending ? (
            <div className="py-16"><Spinner /></div>
          ) : billingQuery.isError ? (
            <div className="p-4">
              <QueryError onRetry={() => void billingQuery.refetch()} />
            </div>
          ) : tenantRows.length === 0 ? (
            <EmptyState message="조회 가능한 업체가 없습니다" />
          ) : (
            <TableFrame minWidthClassName="min-w-[720px]">
              <thead>
                <tr className="border-b border-line bg-bg/40 text-left text-xs font-bold text-t3">
                  <th className="whitespace-nowrap px-4 py-[11px]">업체명</th>
                  <th className="whitespace-nowrap px-4 py-[11px] text-right">알림톡(원)</th>
                  <th className="whitespace-nowrap px-4 py-[11px] text-right">문자(원)</th>
                  <th className="whitespace-nowrap px-4 py-[11px] text-right">팩스(원)</th>
                  <th className="whitespace-nowrap px-4 py-[11px] text-right">합계(원)</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => (
                  <tr key={row.orgId} className="border-b border-line2 text-[13.5px] last:border-0 hover:bg-bg/40">
                    <td className="whitespace-nowrap px-4 py-3 font-extrabold text-t1">{row.orgName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-t2 num">
                      {num(row.alimtalkAmountKrw)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-t2 num">
                      {num(row.smsAmountKrw)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-t2 num">
                      {num(row.faxAmountKrw)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-extrabold text-t1 num">{num(row.subtotalKrw)}</td>
                  </tr>
                ))}
              </tbody>
            </TableFrame>
          )}
          {!billingQuery.isPending
            && !billingQuery.isError
            && (
              <PlatformPagination
                page={currentPage}
                pageSize={PAGE_SIZE}
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
    <article className="rounded-[15px] bg-surface p-[17px] shadow-card">
      <div className="text-[12.5px] font-bold text-t3">{label}</div>
      <div className="mt-[9px] whitespace-nowrap text-[26px] font-extrabold leading-none tracking-[-0.03em] text-t1 num">
        {value}
        <small className="ml-[3px] text-[14px] font-bold tracking-normal text-t3">{unit}</small>
      </div>
      <div className="mt-[7px] truncate text-[12px] font-bold text-t3 num">{sub}</div>
    </article>
  );
}
