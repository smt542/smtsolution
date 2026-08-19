"use client";

import { useMemo, useState } from "react";
import { EmptyState, Spinner } from "@/components/common";
import {
  usePlatformOrgBilling,
  usePlatformOverviewMetrics,
} from "@/hooks/reactquery/platform";
import { DataScopeNotice, PageHeader, QueryError } from "../_components/PageElements";

const num = (n: number) => n.toLocaleString("ko-KR");

function currentMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function shiftMonth(iso: string, delta: number): string {
  const [year, month] = iso.split("-").map(Number);
  const shifted = new Date(year, month - 1 + delta, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}-01`;
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
  const metricsQuery = usePlatformOverviewMetrics(month);
  const billingQuery = usePlatformOrgBilling(month);

  const metrics = metricsQuery.data;
  const appRate = metrics && metrics.unitCount > 0
    ? Math.round((metrics.linkedUnitCount / metrics.unitCount) * 100)
    : 0;
  const costDelta = metrics ? metrics.sendCostKrw - metrics.sendCostPrevKrw : 0;

  const tenantRows = useMemo(
    () => (billingQuery.data ?? []).filter(
      (row) => row.alimtalkCount + row.smsCount + row.faxCount > 0,
    ),
    [billingQuery.data],
  );

  return (
    <div className="mx-auto w-full max-w-7xl p-5 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          eyebrow="HQ CONSOLE"
          title="대시보드"
          description="계약 업체·관리 건물·입주자 앱 연결과 월 발송 비용을 한눈에 확인합니다."
        />
        <MonthStepper month={month} onChange={setMonth} />
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="계약 업체"
              value={`${num(metrics.orgActive)}곳`}
              sub={`정지 ${num(metrics.orgSuspended)} · 해지 ${num(metrics.orgTerminated)}`}
              color="bg-blue-t text-blue"
              icon="M4 21h16M6 21V7l6-3 6 3v14M9 10h2m2 0h2m-6 4h2m2 0h2"
            />
            <KpiCard
              label="관리 건물"
              value={`${num(metrics.buildingCount)}곳`}
              sub={`이번 달 +${num(metrics.buildingAddedThisMonth)}곳`}
              color="bg-green-t text-green"
              icon="M5 21V5h14v16M9 9h2m2 0h2m-6 4h2m2 0h2m-6 4h6"
            />
            <KpiCard
              label="총 입주자"
              value={`${num(metrics.unitCount)}세대`}
              sub={`앱 연결 ${num(metrics.linkedUnitCount)}세대 (${appRate}%)`}
              color="bg-amber-t text-amber"
              icon="M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21a8 8 0 0 1 16 0"
            />
            <KpiCard
              label={`${monthLabel(month).split(" ")[1]} 발송 비용`}
              value={`${num(metrics.sendCostKrw)}원`}
              sub={`전월 대비 ${signed(costDelta)}원`}
              color="bg-blue-t text-blue"
              icon="M3 6h18v12H3zM3 10h18M7 15h4"
            />
          </div>
        )}
      </section>

      <section aria-label="테넌트별 발송 비용" className="mt-6 rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-line p-4">
          <div>
            <h3 className="text-base font-extrabold text-t1">테넌트별 발송 비용</h3>
            <p className="mt-1 text-xs text-t3">{monthLabel(month)} · 발송량 기준 (부가세 제외)</p>
          </div>
        </div>
        {billingQuery.isPending ? (
          <div className="py-16"><Spinner /></div>
        ) : billingQuery.isError ? (
          <div className="p-4"><QueryError onRetry={() => void billingQuery.refetch()} /></div>
        ) : tenantRows.length === 0 ? (
          <EmptyState message="발송 내역이 없습니다" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line bg-bg/70 text-left text-xs font-bold text-t3">
                  <th className="px-5 py-3">업체명</th>
                  <th className="px-4 py-3 text-right">알림톡</th>
                  <th className="px-4 py-3 text-right">문자</th>
                  <th className="px-4 py-3 text-right">팩스</th>
                  <th className="px-5 py-3 text-right">합계(원)</th>
                </tr>
              </thead>
              <tbody>
                {tenantRows.map((row) => (
                  <tr key={row.orgId} className="border-b border-line last:border-0 hover:bg-bg/50">
                    <td className="px-5 py-4 font-bold text-t1">{row.orgName}</td>
                    <td className="px-4 py-4 text-right text-t2 num">{num(row.alimtalkCount)}</td>
                    <td className="px-4 py-4 text-right text-t2 num">{num(row.smsCount)}</td>
                    <td className="px-4 py-4 text-right text-t2 num">{num(row.faxCount)}</td>
                    <td className="px-5 py-4 text-right font-extrabold text-t1 num">{num(row.subtotalKrw)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function MonthStepper({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
      <button
        type="button"
        aria-label="이전 달"
        onClick={() => onChange(shiftMonth(month, -1))}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-t3 hover:bg-bg hover:text-t1"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <span className="min-w-[92px] text-center text-sm font-extrabold text-t1">{monthLabel(month)}</span>
      <button
        type="button"
        aria-label="다음 달"
        onClick={() => onChange(shiftMonth(month, 1))}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-t3 hover:bg-bg hover:text-t1"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </div>
  );
}

function KpiCard({ label, value, sub, color, icon }: { label: string; value: string; sub: string; color: string; icon: string }) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-t2">{label}</div>
          <div className="mt-3 text-[28px] font-extrabold leading-none text-t1 num">{value}</div>
          <div className="mt-2 text-xs text-t4">{sub}</div>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${color}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
            <path d={icon} />
          </svg>
        </div>
      </div>
    </article>
  );
}
