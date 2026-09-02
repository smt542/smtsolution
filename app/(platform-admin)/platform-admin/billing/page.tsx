"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState, Spinner } from "@/components/common";
import {
  useMarkOrgBillingPaid,
  usePlatformOrgBilling,
  usePlatformSettings,
  type PlatformOrgBilling,
  type PlatformOrgBillingStatus,
} from "@/hooks/reactquery/platform";
import { formatNumber } from "@/lib/format";
import {
  BoundedMonthStepper,
  PageHeader,
  PlatformPagination,
  QueryError,
} from "../../_components/PageElements";
import { CollectionToolbar } from "../../_components/CollectionToolbar";
import { InvoiceBulkPrintRoot } from "./_components/InvoiceBulkPrintRoot";
import { invoiceConfigFromSettings } from "./_components/InvoiceDocument";
import { InvoicePreviewModal } from "./_components/InvoicePreviewModal";

const num = (n: number) => formatNumber(n);
const PAGE_SIZE = 8;

function currentMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthLabel(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  return `${year}년 ${month}월`;
}

function deltaPercentLabel(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "—" : "신규";
  const percentage = Math.round(((current - previous) / previous) * 100);
  return `${percentage > 0 ? "+" : ""}${percentage}%`;
}

const STATUS_TABS: { id: "all" | PlatformOrgBillingStatus; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "unpaid", label: "미입금" },
  { id: "paid", label: "입금완료" },
  { id: "none", label: "청구 없음" },
];

export default function PlatformBillingPage() {
  const [month, setMonth] = useState(currentMonthIso);
  const [tab, setTab] = useState<"all" | PlatformOrgBillingStatus>("all");
  const [page, setPage] = useState(1);
  const [previewOrgId, setPreviewOrgId] = useState<number | null>(null);
  const [bulkRows, setBulkRows] = useState<PlatformOrgBilling[]>([]);
  const billingQuery = usePlatformOrgBilling(month);
  const settingsQuery = usePlatformSettings();
  const markPaid = useMarkOrgBillingPaid();
  const invoiceConfig = useMemo(
    () => invoiceConfigFromSettings(settingsQuery.data),
    [settingsQuery.data],
  );

  // Unmount the bulk print root once the print dialog closes so a later single-invoice
  // print does not also emit every organization's invoice.
  useEffect(() => {
    const clearBulk = () => setBulkRows([]);
    window.addEventListener("afterprint", clearBulk);
    return () => window.removeEventListener("afterprint", clearBulk);
  }, []);

  const rows = useMemo(() => billingQuery.data ?? [], [billingQuery.data]);
  const totals = useMemo(
    () => rows.reduce(
      (acc, row) => ({
        alimtalk: acc.alimtalk + row.alimtalkCount,
        sms: acc.sms + row.smsCount,
        lms: acc.lms + row.lmsCount,
        fax: acc.fax + row.faxCount,
        billedKrw: acc.billedKrw + row.subtotalKrw,
        unpaidKrw: acc.unpaidKrw + (row.status === "unpaid" ? row.subtotalKrw : 0),
        unpaidOrganizations: acc.unpaidOrganizations + (row.status === "unpaid" ? 1 : 0),
        paidOrganizations: acc.paidOrganizations + (row.status === "paid" ? 1 : 0),
      }),
      {
        alimtalk: 0,
        sms: 0,
        lms: 0,
        fax: 0,
        billedKrw: 0,
        unpaidKrw: 0,
        unpaidOrganizations: 0,
        paidOrganizations: 0,
      },
    ),
    [rows],
  );
  const filtered = useMemo(
    () => (tab === "all" ? rows : rows.filter((row) => row.status === tab)),
    [rows, tab],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const previewRow = useMemo(
    () => rows.find((row) => row.orgId === previewOrgId) ?? null,
    [rows, previewOrgId],
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

  // "전체 발행": generate an invoice document for every billable (청구액 > 0) org in
  // the current filter, then open the browser print dialog. No state is persisted.
  const handlePublishAll = () => {
    const billable = filtered.filter((row) => row.subtotalKrw > 0);
    if (billable.length === 0) {
      toast.error("발행할 청구서가 없습니다.");
      return;
    }
    setPreviewOrgId(null);
    setBulkRows(billable);
    requestAnimationFrame(() => {
      window.print();
    });
  };

  const handleCsvDownload = () => {
    const header = ["업체명", "이메일", "알림톡", "문자(SMS)", "장문(LMS)", "팩스(발송 건수)", "청구액(공급가액)", "전월비", "상태"];
    const body = filtered.map((row) => [
      row.orgName,
      row.orgEmail ?? "",
      row.alimtalkCount,
      row.smsCount,
      row.lmsCount,
      row.faxCount,
      row.subtotalKrw,
      deltaPercentLabel(row.totalKrw, row.prevTotalKrw),
      STATUS_TABS.find((t) => t.id === row.status)?.label ?? row.status,
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `청구원장_${month.slice(0, 7)}.csv`;
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
        <BoundedMonthStepper
          month={month}
          onChange={(nextMonth) => {
            setMonth(nextMonth);
            setPage(1);
          }}
        />
      </div>

      <section className="mt-6 rounded-2xl bg-surface p-5 shadow-card sm:p-6">
        <p className="text-lg font-extrabold leading-8 text-t1 sm:text-xl">
          {monthLabel(month)} 청구할 발송비는 <span className="text-blue num">{num(totals.billedKrw)}원</span>,
          <br className="hidden sm:block" /> 이 중 <span className="text-red num">{num(totals.unpaidKrw)}원</span>이 아직 입금되지 않았습니다.
        </p>
        <p className="mt-2 text-sm font-semibold text-t3">
          미입금 {num(totals.unpaidOrganizations)}곳 · 입금 완료 {num(totals.paidOrganizations)}곳
          <span className="ml-2 text-xs font-medium text-t4">공급가액 기준</span>
        </p>
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        <SummaryCard label="알림톡" value={totals.alimtalk} />
        <SummaryCard label="문자(SMS)" value={totals.sms} />
        <SummaryCard label="장문(LMS)" value={totals.lms} />
        <SummaryCard label="팩스 발송" value={totals.fax} />
      </div>

      <section className="mt-6 rounded-2xl bg-surface shadow-card">
        <CollectionToolbar
          left={<div className="flex flex-wrap items-center gap-1">
            {STATUS_TABS.map((statusTab) => (
              <button
                key={statusTab.id}
                type="button"
                onClick={() => {
                  setTab(statusTab.id);
                  setPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
                  tab === statusTab.id ? "bg-blue text-white" : "text-t3 hover:bg-bg"
                }`}
              >
                {statusTab.label}
              </button>
            ))}
          </div>}
          right={<div className="flex items-center gap-2">
            <Button variant="ghost" onClick={handleCsvDownload} disabled={filtered.length === 0}>
              원장 CSV
            </Button>
            <Button
              onClick={handlePublishAll}
              disabled={filtered.every((row) => row.subtotalKrw <= 0)}
            >
              전체 발행
            </Button>
          </div>}
        />

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
                  <th className="px-4 py-3 text-right">팩스</th>
                  <th className="px-4 py-3 text-right">청구액(공급가액)</th>
                  <th className="px-4 py-3 text-right">전월비</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-5 py-3 text-right">처리</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => (
                  <tr key={row.orgId} className="border-b border-line last:border-0 hover:bg-bg/50">
                    <td className="px-5 py-4 font-bold text-t1">{row.orgName}</td>
                    <td className="px-4 py-4 text-t3">{row.orgEmail ?? "—"}</td>
                    <td className="px-4 py-4 text-right text-t2 num">{num(row.alimtalkCount)}</td>
                    <td className="px-4 py-4 text-right text-t2 num">{num(row.smsCount)}</td>
                    <td className="px-4 py-4 text-right text-t2 num">{num(row.lmsCount)}</td>
                    <td className="px-4 py-4 text-right text-t2 num">{num(row.faxCount)}</td>
                    <td className="px-4 py-4 text-right font-extrabold text-t1 num">{num(row.subtotalKrw)}</td>
                    <td className="px-4 py-4 text-right text-t3 num">{deltaPercentLabel(row.totalKrw, row.prevTotalKrw)}</td>
                    <td className="px-4 py-4"><BillingStatusBadge status={row.status} /></td>
                    <td className="px-5 py-4 text-right">
                      {row.status === "none" ? (
                        <span className="text-t4">—</span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setBulkRows([]);
                              setPreviewOrgId(row.orgId);
                            }}
                          >
                            발행
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => void handleToggle(row)}
                            disabled={markPaid.isPending}
                          >
                            {row.status === "paid" ? "입금 취소" : "입금 확인"}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!billingQuery.isPending && !billingQuery.isError && (
          <PlatformPagination
            page={currentPage}
            pageSize={PAGE_SIZE}
            totalCount={filtered.length}
            onPageChange={setPage}
            numeric
            totalLabel={`전체 ${num(filtered.length)}곳`}
          />
        )}
      </section>

      {previewRow && (
        <InvoicePreviewModal
          row={previewRow}
          month={month}
          config={invoiceConfig}
          settings={settingsQuery.data}
          onClose={() => setPreviewOrgId(null)}
        />
      )}

      {bulkRows.length > 0 && (
        <InvoiceBulkPrintRoot
          rows={bulkRows}
          month={month}
          config={invoiceConfig}
          settings={settingsQuery.data}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl bg-surface p-5 shadow-card">
      <div className="text-sm font-bold text-t2">{label}</div>
      <div className="mt-2 text-2xl font-extrabold text-t1 num">{num(value)}<span className="ml-1 text-sm font-bold text-t3">건</span></div>
    </article>
  );
}

function BillingStatusBadge({ status }: { status: PlatformOrgBillingStatus }) {
  const view = {
    paid: { label: "입금완료", className: "bg-green-t text-green" },
    unpaid: { label: "미입금", className: "bg-red-t text-red" },
    none: { label: "청구 없음", className: "bg-bg text-t3" },
  }[status];
  return <span className={`inline-flex rounded-[7px] px-2.5 py-1 text-[11px] font-bold ${view.className}`}>{view.label}</span>;
}
