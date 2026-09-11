"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Modal, Spinner } from "@/components/common";
import {
  listPlatformOrganizations,
  platformKeys,
  useChargePoints,
  useMessagePointRates,
  usePlatformOrgBilling,
  usePlatformSettings,
  usePlatformTransactions,
  type PlatformOrganizationQuery,
} from "@/hooks/reactquery/platform";
import { formatNumber } from "@/lib/format";
import { toast } from "sonner";
import { QueryError } from "../../../_components/PageElements";
import { PlatformPageContainer } from "../../../_components/PlatformPageContainer";

const PointChargeModal = dynamic(() =>
  import("./components/PointChargeModal").then((module) => module.PointChargeModal),
);

const ALL_ORGANIZATIONS_QUERY = { pageSize: 200 } satisfies PlatformOrganizationQuery;
const CHARGE_HISTORY_PAGE_SIZE = 8;
const dateFmt = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const num = (value: number) => formatNumber(value);

function currentMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

async function listAllPlatformOrganizations() {
  const firstPage = await listPlatformOrganizations(ALL_ORGANIZATIONS_QUERY);
  const pageCount = Math.ceil(firstPage.totalCount / firstPage.pageSize);

  if (pageCount <= 1) return firstPage;

  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      listPlatformOrganizations({
        ...ALL_ORGANIZATIONS_QUERY,
        page: index + 2,
      }),
    ),
  );

  return {
    ...firstPage,
    rows: [firstPage, ...remainingPages].flatMap((page) => page.rows),
  };
}

export default function PointsWorkspace() {
  const [chargeModalOpen, setChargeModalOpen] = useState(false);
  const modalOrgsQuery = useQuery({
    queryKey: platformKeys.organizations(ALL_ORGANIZATIONS_QUERY),
    queryFn: listAllPlatformOrganizations,
  });
  const billingQuery = usePlatformOrgBilling(currentMonthIso());
  const ratesQuery = useMessagePointRates();
  const settingsQuery = usePlatformSettings();
  const txQuery = usePlatformTransactions({
    type: "charge",
    pageSize: CHARGE_HISTORY_PAGE_SIZE,
  });
  const charge = useChargePoints();

  const modalOrganizations = useMemo(
    () => (modalOrgsQuery.data?.rows ?? []).filter((organization) => !organization.deletedAt),
    [modalOrgsQuery.data],
  );
  const poolBalance = useMemo(
    () => modalOrganizations.reduce((total, organization) => total + organization.availablePoints, 0),
    [modalOrganizations],
  );
  const billingTotals = useMemo(
    () => (billingQuery.data ?? []).reduce(
      (total, row) => ({
        alimtalkCount: total.alimtalkCount + row.alimtalkCount,
        smsCount: total.smsCount + row.smsCount,
        lmsCount: total.lmsCount + row.lmsCount,
        faxCount: total.faxCount + row.faxCount,
        subtotalKrw: total.subtotalKrw + row.subtotalKrw,
      }),
      {
        alimtalkCount: 0,
        smsCount: 0,
        lmsCount: 0,
        faxCount: 0,
        subtotalKrw: 0,
      },
    ),
    [billingQuery.data],
  );
  const activeRates = useMemo(
    () => new Map(
      (ratesQuery.data ?? [])
        .filter((rate) => rate.isActive)
        .map((rate) => [rate.channel, rate.points]),
    ),
    [ratesQuery.data],
  );
  const chargeTransactions = useMemo(
    () => (txQuery.data?.pages.flatMap((page) => page.rows) ?? [])
      .filter((transaction) => transaction.type === "charge"),
    [txQuery.data],
  );

  const alimtalkPoints = billingTotals.alimtalkCount * (activeRates.get("alimtalk") ?? 0);
  const smsPoints = (
    billingTotals.smsCount * (activeRates.get("sms") ?? 0)
    + billingTotals.lmsCount * (activeRates.get("lms") ?? 0)
  );
  const faxPoints = billingTotals.faxCount * (settingsQuery.data?.rateKrwFax ?? 0);
  const monthUsedPoints = alimtalkPoints + smsPoints + faxPoints;
  const messageCount = billingTotals.smsCount + billingTotals.lmsCount;
  const railTotal = monthUsedPoints > 0 ? monthUsedPoints : 1;
  const lowBalanceThreshold = settingsQuery.data?.lowBalanceThreshold ?? 0;
  const summaryPending = modalOrgsQuery.isPending
    || billingQuery.isPending
    || ratesQuery.isPending
    || settingsQuery.isPending;
  const summaryError = modalOrgsQuery.isError
    || billingQuery.isError
    || ratesQuery.isError
    || settingsQuery.isError;
  const summaryReady = !summaryPending && !summaryError;
  const sendingStopped = summaryReady && poolBalance <= 0;
  const chargeNeeded = summaryReady
    && poolBalance > 0
    && poolBalance <= lowBalanceThreshold;
  const pickerUnavailable = modalOrgsQuery.data
    ? modalOrganizations.length === 0
    : modalOrgsQuery.isPending;
  const chargeTotalCount = txQuery.data?.pages[0]?.totalCount ?? 0;

  const retrySummary = () => {
    void Promise.all([
      modalOrgsQuery.refetch(),
      billingQuery.refetch(),
      ratesQuery.refetch(),
      settingsQuery.refetch(),
    ]);
  };

  const handleCharge = async (values: {
    orgId: number;
    points: number;
    amountKrw: number;
    memo?: string;
  }) => {
    try {
      await charge.mutateAsync(values);
      toast.success("포인트 충전을 기록했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "충전 기록에 실패했습니다.");
      throw error;
    }
  };

  return (
    <PlatformPageContainer>
      <div className="mb-3 flex justify-end">
        <Link
          href="/platform-admin/points/organizations"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-bold text-t3 transition-colors hover:bg-surface hover:text-t1"
        >
          조직별 포인트 관리
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </Link>
      </div>

      {sendingStopped && (
        <div className="mb-4 flex items-start gap-[9px] rounded-[14px] border border-[#F3C5C5] bg-red-t px-4 py-3.5 text-[13.5px] font-semibold leading-[1.6] text-[#A32020]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.3 3.7 2.4 17.4A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.6L13.7 3.7a2 2 0 0 0-3.4 0Z" />
          </svg>
          <span>
            팝빌 포인트가 모두 소진되어 <b className="font-extrabold text-[#8E1A1A]">알림톡·문자·팩스 발송이 모두 중단</b>되었어요.
            충전해야 관리비 고지와 공지가 다시 발송됩니다.
          </span>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl bg-surface shadow-card">
        <div className="flex items-center gap-2.5 border-b border-line2 px-[18px] py-[15px]">
          <h2 className="text-[15px] font-extrabold text-t1">팝빌 포인트</h2>
          <p className="text-xs font-semibold text-t3">1원 = 1P · 알림톡·문자·팩스 공통 차감</p>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setChargeModalOpen(true)}
            disabled={pickerUnavailable}
            className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-[11px] border border-transparent bg-blue px-[15px] text-[13.5px] font-bold text-white shadow-hf-btn transition-colors hover:bg-blue-d disabled:cursor-not-allowed disabled:opacity-60"
          >
            충전 기록
          </button>
        </div>

        {summaryPending ? (
          <div className="py-16"><Spinner /></div>
        ) : summaryError ? (
          <div className="p-[22px]"><QueryError onRetry={retrySummary} /></div>
        ) : (
          <div className="px-[22px] pb-[22px] pt-5">
            <div className="flex flex-wrap items-end gap-[14px]">
              <strong
                className={`text-[30px] font-extrabold leading-none tracking-[-0.03em] tabular-nums ${
                  sendingStopped ? "text-red" : "text-t1"
                }`}
              >
                {num(poolBalance)}P
              </strong>
              {sendingStopped ? (
                <Badge className="inline-flex bg-red-t px-[9px] py-[3px] leading-[1.4] text-red">
                  발송 중단
                </Badge>
              ) : chargeNeeded ? (
                <Badge className="inline-flex bg-amber-t px-[9px] py-[3px] leading-[1.4] text-amber">
                  충전 필요
                </Badge>
              ) : null}
              <p className="mt-[9px] w-full text-[12.5px] font-semibold text-t3">
                이번 달 사용 <b className="font-extrabold text-t2 tabular-nums">{num(monthUsedPoints)}P</b>
              </p>
            </div>

            <div className="mt-5 border-t border-line2 pt-4 text-[12.5px] font-bold text-t3">
              이번 달 채널별 소진
            </div>
            <div
              className="mt-[11px] flex h-[9px] overflow-hidden rounded-md bg-line2"
              role="img"
              aria-label={`알림톡 ${num(alimtalkPoints)}P, 문자 ${num(smsPoints)}P, 팩스 ${num(faxPoints)}P`}
            >
              <span
                className="h-full bg-blue"
                style={{ width: `${(alimtalkPoints / railTotal) * 100}%` }}
                aria-hidden="true"
              />
              <span
                className="h-full bg-[#7CC7BF]"
                style={{ width: `${(smsPoints / railTotal) * 100}%` }}
                aria-hidden="true"
              />
              <span
                className="h-full bg-[#C6D3DC]"
                style={{ width: `${(faxPoints / railTotal) * 100}%` }}
                aria-hidden="true"
              />
            </div>
            <div className="mt-[13px] flex flex-wrap gap-5">
              <ChannelLegend
                label="알림톡"
                points={alimtalkPoints}
                count={billingTotals.alimtalkCount}
                swatchClassName="bg-blue"
              />
              <ChannelLegend
                label="문자"
                points={smsPoints}
                count={messageCount}
                swatchClassName="bg-[#7CC7BF]"
              />
              <ChannelLegend
                label="팩스"
                points={faxPoints}
                count={billingTotals.faxCount}
                swatchClassName="bg-[#C6D3DC]"
              />
              <p className="ml-auto text-[12.5px] font-semibold text-t3 tabular-nums">
                이번 달 합계 {num(monthUsedPoints)}P
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="mt-4 flex min-h-[360px] flex-col overflow-hidden rounded-2xl bg-surface shadow-card">
        <div className="flex items-center gap-2.5 border-b border-line2 px-[18px] py-[15px]">
          <h2 className="text-[15px] font-extrabold text-t1">충전 이력</h2>
          <span className="text-xs font-semibold text-t3 tabular-nums">{num(chargeTotalCount)}건</span>
        </div>
        <div className="min-h-0 flex-1">
          {txQuery.isPending ? (
            <div className="py-16"><Spinner /></div>
          ) : txQuery.isError ? (
            <div className="p-4"><QueryError onRetry={() => void txQuery.refetch()} /></div>
          ) : chargeTransactions.length === 0 ? (
            <div className="px-[18px] py-[34px] text-center text-[13.5px] font-semibold text-t3">
              충전 이력이 없습니다.
            </div>
          ) : (
            chargeTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center gap-3 border-b border-line2 px-[18px] py-[14px] last:border-b-0"
              >
                <div className="min-w-0 flex-1 text-sm font-bold text-t1 tabular-nums">
                  {num(transaction.points)}P
                  <em className="mt-[3px] block truncate text-[12.5px] font-semibold not-italic text-t3 tabular-nums">
                    {dateFmt.format(new Date(transaction.createdAt))} · {transaction.createdByName ?? "기록자 미상"} · {transaction.organizationName}
                  </em>
                </div>
                {transaction.memo && (
                  <span className="max-w-[40%] truncate text-[13px] font-bold text-t3">
                    {transaction.memo}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
        {txQuery.hasNextPage && (
          <div className="flex justify-center border-t border-line2 px-[14px] py-[11px]">
            <button
              type="button"
              onClick={() => void txQuery.fetchNextPage()}
              disabled={txQuery.isFetchingNextPage}
              className="h-7 rounded-lg px-3 text-[12.5px] font-bold text-t3 transition-colors hover:bg-bg hover:text-t1 disabled:cursor-not-allowed disabled:text-t4"
            >
              {txQuery.isFetchingNextPage ? "불러오는 중" : "충전 이력 더 보기"}
            </button>
          </div>
        )}
      </section>

      {chargeModalOpen && (
        modalOrgsQuery.isPending || modalOrgsQuery.isError ? (
          <OrganizationPickerQueryModal
            isError={modalOrgsQuery.isError}
            onClose={() => setChargeModalOpen(false)}
            onRetry={() => void modalOrgsQuery.refetch()}
          />
        ) : (
          <PointChargeModal
            open
            onClose={() => setChargeModalOpen(false)}
            organizations={modalOrganizations}
            onSubmit={handleCharge}
            isPending={charge.isPending}
          />
        )
      )}
    </PlatformPageContainer>
  );
}

function ChannelLegend({
  label,
  points,
  count,
  swatchClassName,
}: {
  label: string;
  points: number;
  count: number;
  swatchClassName: string;
}) {
  return (
    <div className="flex items-center gap-[7px] text-[12.5px] font-bold text-t2">
      <span className={`h-[9px] w-[9px] shrink-0 rounded-[3px] ${swatchClassName}`} aria-hidden="true" />
      {label}
      <span className="font-semibold text-t3 tabular-nums">{num(points)}P · {num(count)}건</span>
    </div>
  );
}

function OrganizationPickerQueryModal({
  isError,
  onClose,
  onRetry,
}: {
  isError: boolean;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title="포인트 충전 기록"
      className="max-w-[440px] rounded-[20px] shadow-hf-modal [&>h2]:text-[17px] [&>h2]:tracking-[-0.02em] [&>h2]:text-t1"
    >
      {isError ? <QueryError onRetry={onRetry} /> : <Spinner />}
    </Modal>
  );
}
