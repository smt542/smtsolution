"use client";

import { useMemo, useRef, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Badge, EmptyState, Spinner } from "@/components/common";
import { DpMonthPicker } from "@/components/common/DpMonthPicker";
import {
  useMarkOrgBillingPaid,
  usePlatformOrgBilling,
  usePlatformSettings,
  type PlatformOrgBilling,
  type PlatformOrgBillingStatus,
} from "@/hooks/reactquery/platform";
import { formatNumber } from "@/lib/format";
import { PlatformPagination, QueryError } from "../../../_components/PageElements";
import { PlatformPageContainer } from "../../../_components/PlatformPageContainer";
import { useFitPageSize } from "../../../_components/useFitPageSize";
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

// 정본 .dlt: 늘었으면 빨강(up), 아니면 회색 — 전월 0원에서 생긴 청구(신규)도 늘어난 쪽
function deltaPercent(current: number, previous: number): { label: string; up: boolean } {
  if (previous === 0) return current === 0 ? { label: "-", up: false } : { label: "신규", up: true };
  const percentage = Math.round(((current - previous) / previous) * 100);
  return { label: `${percentage > 0 ? "+" : ""}${percentage}%`, up: percentage > 0 };
}

const STATUS_TABS: { id: "all" | PlatformOrgBillingStatus; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "unpaid", label: "미입금" },
  { id: "paid", label: "입금완료" },
  { id: "none", label: "청구 없음" },
];

export function BillingWorkspace() {
  const [currentMonth] = useState(currentMonthIso);
  const [month, setMonth] = useState(currentMonth);
  const [tab, setTab] = useState<"all" | PlatformOrgBillingStatus>("all");
  const [page, setPage] = useState(1);
  const [previewOrgId, setPreviewOrgId] = useState<number | null>(null);
  const [publishingAll, setPublishingAll] = useState(false);
  const [togglingOrgIds, setTogglingOrgIds] = useState<ReadonlySet<number>>(() => new Set());
  const scrollerRef = useRef<HTMLDivElement>(null);
  const billingQuery = usePlatformOrgBilling(month);
  const settingsQuery = usePlatformSettings();
  const markPaid = useMarkOrgBillingPaid();
  const invoiceConfig = useMemo(
    () => invoiceConfigFromSettings(settingsQuery.data),
    [settingsQuery.data],
  );

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
  // 정본 draw: 청구액 큰 순(같으면 받은 순서 = 업체명 순)
  const filtered = useMemo(() => {
    const list = tab === "all" ? rows : rows.filter((row) => row.status === tab);
    return [...list].sort((a, b) => b.subtotalKrw - a.subtotalKrw);
  }, [rows, tab]);
  // 정본 fitBm: 목록 영역 남는 높이에 들어가는 만큼 한 쪽 행 수(최소 3)
  const pageSize = useFitPageSize(scrollerRef, { fallback: PAGE_SIZE, watch: filtered });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const previewRow = useMemo(
    () => rows.find((row) => row.orgId === previewOrgId) ?? null,
    [rows, previewOrgId],
  );

  // 누른 행만 잠근다 — 목록이 새 상태로 다시 그려질 때까지(무효화로 이미 도는 재조회를 기다려 중복 요청 없음)
  const handleToggle = async (row: PlatformOrgBilling) => {
    if (togglingOrgIds.has(row.orgId)) return;
    const nextPaid = row.status !== "paid";
    setTogglingOrgIds((current) => new Set(current).add(row.orgId));
    try {
      await markPaid.mutateAsync({ orgId: row.orgId, month, paid: nextPaid });
      toast.success(nextPaid ? "입금을 확인했어요" : "입금 확인을 취소했어요");
      await billingQuery.refetch({ cancelRefetch: false });
    } catch (error) {
      toast.error(error, "처리에 실패했습니다.");
    } finally {
      setTogglingOrgIds((current) => {
        const next = new Set(current);
        next.delete(row.orgId);
        return next;
      });
    }
  };

  // "전체 발행": 지금 목록(탭)에서 청구액이 있는 업체마다 PDF 청구서를 차례로 내려받는다. 저장되는 상태 없음.
  // 문구는 정본 #bmAll('N곳의 청구서를 만들고 있어요' → 'N곳의 청구서를 저장했어요'). 만드는 동안 다시 눌러도 무시
  const handlePublishAll = async () => {
    if (publishingAll) return;
    const billable = filtered.filter((row) => row.subtotalKrw > 0);
    if (billable.length === 0) {
      toast.warning("발행할 청구서가 없어요");
      return;
    }
    setPublishingAll(true);
    toast.info(`${billable.length}곳의 청구서를 만들고 있어요`);
    try {
      const { downloadInvoicePdfs } = await import("./_components/InvoicePdf");
      await downloadInvoicePdfs(billable, month, invoiceConfig, settingsQuery.data);
      toast.success(`${billable.length}곳의 청구서를 저장했어요`);
    } catch (error) {
      toast.error(error, "저장에 실패했어요");
    } finally {
      setPublishingAll(false);
    }
  };

  // 정본 hf-body(패딩 22·24·30, 간격 16) — 안내는 내용 높이, 목록 패널이 남는 높이를 채운다(최소 280)
  return (
    <PlatformPageContainer
      maxWidthClassName="max-w-none"
      paddingClassName="flex h-[calc(100dvh-62px)] flex-col gap-4 overflow-auto px-6 pb-[30px] pt-[22px]"
    >
      <section className="flex-none rounded-[18px] bg-surface px-6 py-[22px] shadow-card">
        <div className="mb-[14px] flex items-center">
          {/* 정본 #bmDd: .hq-dd 트리거 + .hq-ymp 연·월 팝업(트리거 왼쪽 맞춤, 2025년 1월 ~ 이번 달) */}
          <DpMonthPicker
            value={month.slice(0, 7)}
            onChange={(nextMonth) => {
              setMonth(`${nextMonth}-01`);
              setPage(1);
            }}
            variant="hq"
            align="start"
            minMonth="2025-01"
            maxMonth={currentMonth.slice(0, 7)}
            ariaLabel="청구 월"
          />
        </div>
        <p className="text-[25px] font-extrabold leading-[1.4] tracking-[-0.03em] text-t1">
          {monthLabel(month)} 청구할 발송비는 <span className="text-blue num">{num(totals.billedKrw)}원</span>,
          <br className="hidden sm:block" /> 이 중 <span className="text-red num">{num(totals.unpaidKrw)}원</span>이 아직 입금되지 않았습니다.
        </p>
        <p className="mt-[9px] text-[13.5px] font-semibold leading-[1.6] text-t3">
          미입금 {num(totals.unpaidOrganizations)}곳 · 입금 완료 {num(totals.paidOrganizations)}곳
          <span className="ml-2 text-xs font-medium text-t4">공급가액 기준</span>
        </p>
        <div className="mt-[18px] flex flex-wrap gap-x-[26px] gap-y-2 border-t border-line2 pt-4">
          <SummaryCard label="알림톡" value={totals.alimtalk} />
          <SummaryCard label="문자(SMS)" value={totals.sms} />
          <SummaryCard label="장문(LMS)" value={totals.lms} />
          <SummaryCard label="팩스 발송" value={totals.fax} />
        </div>
      </section>

      <section className="flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-2xl bg-surface shadow-card">
        <div className="flex flex-none items-center gap-2.5 overflow-x-auto border-b border-line2 px-[18px] py-[15px]">
          <div className="inline-flex shrink-0 gap-0.5 rounded-[11px] bg-[#EDF0F3] p-[3px]">
            {STATUS_TABS.map((statusTab) => (
              <button
                key={statusTab.id}
                type="button"
                aria-pressed={tab === statusTab.id}
                onClick={() => {
                  setTab(statusTab.id);
                  setPage(1);
                }}
                className={`cursor-pointer rounded-lg px-[13px] py-[5px] text-[12.5px] font-bold whitespace-nowrap ${
                  tab === statusTab.id
                    ? "bg-surface text-t1 shadow-[0_2px_6px_rgba(23,31,40,0.1)]"
                    : "text-t3 hover:text-t1"
                }`}
              >
                {statusTab.label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => void handlePublishAll()}
            disabled={filtered.every((row) => row.subtotalKrw <= 0)}
            className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[11px] border border-transparent bg-blue px-[14px] text-[12.5px] font-bold whitespace-nowrap text-white shadow-hf-btn hover:bg-blue-d disabled:cursor-not-allowed disabled:opacity-50"
          >
            전체 발행
          </button>
        </div>

        <div ref={scrollerRef} className="min-h-0 flex-1 overflow-auto">
          {billingQuery.isPending ? (
            <div className="py-16"><Spinner /></div>
          ) : billingQuery.isError ? (
            <div className="p-4"><QueryError onRetry={() => void billingQuery.refetch()} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState message="해당 조건의 청구 내역이 없습니다" />
          ) : (
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="text-left">
                  <th className="w-[15%] border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-xs font-bold whitespace-nowrap text-t3">업체명</th>
                  <th className="w-[18%] border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-xs font-bold whitespace-nowrap text-t3">이메일</th>
                  <th className="border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-right text-xs font-bold whitespace-nowrap text-t3">알림톡</th>
                  <th className="border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-right text-xs font-bold whitespace-nowrap text-t3">문자</th>
                  <th className="border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-right text-xs font-bold whitespace-nowrap text-t3">장문</th>
                  <th className="border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-right text-xs font-bold whitespace-nowrap text-t3">팩스</th>
                  <th className="border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-right text-xs font-bold whitespace-nowrap text-t3">청구액(공급가액)</th>
                  <th className="border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-right text-xs font-bold whitespace-nowrap text-t3">전월비</th>
                  <th className="border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-xs font-bold whitespace-nowrap text-t3">상태</th>
                  <th className="border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-right text-xs font-bold whitespace-nowrap text-t3">처리</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => {
                  const delta = deltaPercent(row.totalKrw, row.prevTotalKrw);
                  const toggling = togglingOrgIds.has(row.orgId);
                  return (
                    <tr key={row.orgId} className="cursor-pointer hover:bg-[#FBFCFD] [&:last-child>td]:border-b-0">
                      <td className="border-b border-line2 px-4 py-3 text-[13.5px] font-bold whitespace-nowrap text-t1">{row.orgName}</td>
                      <td className="border-b border-line2 px-4 py-3 text-[12.5px] font-semibold whitespace-nowrap text-t3">{row.orgEmail ?? "-"}</td>
                      <td className="border-b border-line2 px-4 py-3 text-right text-[13.5px] whitespace-nowrap text-t1 num">{num(row.alimtalkCount)}</td>
                      <td className="border-b border-line2 px-4 py-3 text-right text-[13.5px] whitespace-nowrap text-t1 num">{num(row.smsCount)}</td>
                      <td className="border-b border-line2 px-4 py-3 text-right text-[13.5px] whitespace-nowrap text-t1 num">{num(row.lmsCount)}</td>
                      <td className="border-b border-line2 px-4 py-3 text-right text-[13.5px] whitespace-nowrap text-t1 num">{num(row.faxCount)}</td>
                      <td className="border-b border-line2 px-4 py-3 text-right text-[13.5px] font-extrabold whitespace-nowrap text-t1 num">{num(row.subtotalKrw)}</td>
                      <td className={`border-b border-line2 px-4 py-3 text-right text-[12.5px] font-bold whitespace-nowrap num ${delta.up ? "text-red" : "text-t3"}`}>{delta.label}</td>
                      <td className="border-b border-line2 px-4 py-3 text-[13.5px] whitespace-nowrap"><BillingStatusBadge status={row.status} /></td>
                      <td className="border-b border-line2 px-4 py-3 text-right text-[13.5px] whitespace-nowrap">
                        {row.status === "none" ? (
                          <span className="inline-flex h-7 items-center text-t4">-</span>
                        ) : (
                          <div className="inline-flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPreviewOrgId(row.orgId)}
                              className="inline-flex h-7 cursor-pointer items-center rounded-lg border border-line bg-surface px-[11px] text-xs font-bold text-t2 hover:bg-bg"
                            >
                              발행
                            </button>
                            {/* 정본 .bm-a / .bm-a.pri — 입금 확인만 청록 채움(hover 변화 없음) */}
                            <button
                              type="button"
                              onClick={() => void handleToggle(row)}
                              disabled={toggling}
                              className={`inline-flex h-7 cursor-pointer items-center rounded-lg border px-[11px] text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ${
                                row.status === "paid"
                                  ? "border-line bg-surface text-t2 hover:bg-bg"
                                  : "border-blue bg-blue text-white"
                              }`}
                            >
                              {row.status === "paid" ? "입금 취소" : "입금 확인"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {!billingQuery.isPending && !billingQuery.isError && (
          <PlatformPagination
            page={currentPage}
            pageSize={pageSize}
            totalCount={filtered.length}
            onPageChange={setPage}
            numeric
            compact
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
    </PlatformPageContainer>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[12.5px] font-semibold text-t3">{label}</span>
      <strong className="text-[14.5px] font-extrabold text-t1 num">{num(value)}건</strong>
    </div>
  );
}

// 정본 LB: 미입금 .b-amber · 입금완료 .b-blue · 청구 없음 .b-gray
function BillingStatusBadge({ status }: { status: PlatformOrgBillingStatus }) {
  const view = {
    paid: { label: "입금완료", tone: "blue" },
    unpaid: { label: "미입금", tone: "amber" },
    none: { label: "청구 없음", tone: "gray" },
  } as const;
  return (
    <Badge tone={view[status].tone} className="inline-flex items-center gap-1 px-[9px] py-[3px] leading-[1.4]">
      {view[status].label}
    </Badge>
  );
}
