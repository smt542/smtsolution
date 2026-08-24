"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState, Spinner } from "@/components/common";
import {
  useMarkOrgBillingPaid,
  usePlatformOrgBilling,
  type PlatformOrgBilling,
  type PlatformOrgBillingStatus,
} from "@/hooks/reactquery/platform";
import { PageHeader, QueryError } from "../../_components/PageElements";

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

function deltaLabel(n: number): string {
  if (n === 0) return "—";
  return `${n > 0 ? "▲" : "▼"} ${num(Math.abs(n))}`;
}

const STATUS_TABS: { id: "all" | PlatformOrgBillingStatus; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "unpaid", label: "미입금" },
  { id: "paid", label: "입금" },
  { id: "none", label: "청구 없음" },
];

export default function PlatformBillingPage() {
  const [month, setMonth] = useState(currentMonthIso);
  const [tab, setTab] = useState<"all" | PlatformOrgBillingStatus>("all");
  const billingQuery = usePlatformOrgBilling(month);
  const markPaid = useMarkOrgBillingPaid();

  const rows = useMemo(() => billingQuery.data ?? [], [billingQuery.data]);
  const totals = useMemo(
    () => rows.reduce(
      (acc, row) => ({
        alimtalk: acc.alimtalk + row.alimtalkCount,
        sms: acc.sms + row.smsCount,
        lms: acc.lms + row.lmsCount,
        faxPages: acc.faxPages + row.faxPageCount,
      }),
      { alimtalk: 0, sms: 0, lms: 0, faxPages: 0 },
    ),
    [rows],
  );
  const filtered = useMemo(
    () => (tab === "all" ? rows : rows.filter((row) => row.status === tab)),
    [rows, tab],
  );

  const handleToggle = async (row: PlatformOrgBilling) => {
    const nextPaid = row.status !== "paid";
    try {
      await markPaid.mutateAsync({ orgId: row.orgId, month, paid: nextPaid });
      toast.success(nextPaid ? "입금 처리했습니다." : "입금을 취소했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "처리에 실패했습니다.");
    }
  };

  const handleDownload = () => {
    const header = ["업체명", "이메일", "알림톡", "문자(SMS)", "장문(LMS)", "팩스(성공페이지)", "청구액", "전월비", "상태"];
    const body = filtered.map((row) => [
      row.orgName,
      row.orgEmail ?? "",
      row.alimtalkCount,
      row.smsCount,
      row.lmsCount,
      row.faxPageCount,
      row.totalKrw,
      row.totalKrw - row.prevTotalKrw,
      STATUS_TABS.find((t) => t.id === row.status)?.label ?? row.status,
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `청구_${month.slice(0, 7)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto w-full max-w-7xl p-5 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          eyebrow="BILLING"
          title="청구 관리"
          description="테넌트별 월 발송 사용량과 청구액·입금 상태를 관리합니다."
        />
        <MonthStepper month={month} onChange={(m) => { setMonth(m); }} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <SummaryCard label="알림톡" value={totals.alimtalk} />
        <SummaryCard label="문자(SMS)" value={totals.sms} />
        <SummaryCard label="장문(LMS)" value={totals.lms} />
        <SummaryCard label="팩스 성공 페이지" value={totals.faxPages} />
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1">
            {STATUS_TABS.map((statusTab) => (
              <button
                key={statusTab.id}
                type="button"
                onClick={() => setTab(statusTab.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
                  tab === statusTab.id ? "bg-blue text-white" : "text-t3 hover:bg-bg"
                }`}
              >
                {statusTab.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" onClick={handleDownload} disabled={filtered.length === 0}>
            청구서 다운로드
          </Button>
        </div>

        {billingQuery.isPending ? (
          <div className="py-16"><Spinner /></div>
        ) : billingQuery.isError ? (
          <div className="p-4"><QueryError onRetry={() => void billingQuery.refetch()} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState message="해당 조건의 청구 내역이 없습니다" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-line bg-bg/70 text-left text-xs font-bold text-t3">
                  <th className="px-5 py-3">업체명</th>
                  <th className="px-4 py-3">이메일</th>
                  <th className="px-4 py-3 text-right">알림톡</th>
                  <th className="px-4 py-3 text-right">문자</th>
                  <th className="px-4 py-3 text-right">장문</th>
                  <th className="px-4 py-3 text-right">팩스 페이지</th>
                  <th className="px-4 py-3 text-right">청구액(원)</th>
                  <th className="px-4 py-3 text-right">전월비</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-5 py-3 text-right">처리</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.orgId} className="border-b border-line last:border-0 hover:bg-bg/50">
                    <td className="px-5 py-4 font-bold text-t1">{row.orgName}</td>
                    <td className="px-4 py-4 text-t3">{row.orgEmail ?? "—"}</td>
                    <td className="px-4 py-4 text-right text-t2 num">{num(row.alimtalkCount)}</td>
                    <td className="px-4 py-4 text-right text-t2 num">{num(row.smsCount)}</td>
                    <td className="px-4 py-4 text-right text-t2 num">{num(row.lmsCount)}</td>
                    <td className="px-4 py-4 text-right text-t2 num">{num(row.faxPageCount)}</td>
                    <td className="px-4 py-4 text-right font-extrabold text-t1 num">{num(row.totalKrw)}</td>
                    <td className="px-4 py-4 text-right text-t3 num">{deltaLabel(row.totalKrw - row.prevTotalKrw)}</td>
                    <td className="px-4 py-4"><BillingStatusBadge status={row.status} /></td>
                    <td className="px-5 py-4 text-right">
                      {row.status === "none" ? (
                        <span className="text-t4">—</span>
                      ) : (
                        <Button
                          variant="ghost"
                          onClick={() => void handleToggle(row)}
                          disabled={markPaid.isPending}
                        >
                          {row.status === "paid" ? "입금 취소" : "입금 처리"}
                        </Button>
                      )}
                    </td>
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

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="text-sm font-bold text-t2">{label}</div>
      <div className="mt-2 text-2xl font-extrabold text-t1 num">{num(value)}<span className="ml-1 text-sm font-bold text-t3">건</span></div>
    </article>
  );
}

function BillingStatusBadge({ status }: { status: PlatformOrgBillingStatus }) {
  const view = {
    paid: { label: "입금", className: "bg-green-t text-green" },
    unpaid: { label: "미입금", className: "bg-red-t text-red" },
    none: { label: "청구 없음", className: "bg-bg text-t3" },
  }[status];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${view.className}`}>{view.label}</span>;
}
