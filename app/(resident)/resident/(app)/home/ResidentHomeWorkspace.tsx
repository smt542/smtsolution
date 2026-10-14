"use client";

import Link from "next/link";
import { useState } from "react";

import BottomNav from "@/app/(resident)/_components/BottomNav";
import MoveOutSection from "@/app/(resident)/_components/MoveOutSection";
import ResidentAsyncState from "@/app/(resident)/_components/ResidentAsyncState";
import ResidentBottomSheet from "@/app/(resident)/_components/ResidentBottomSheet";
import { ResidentButton } from "@/app/(resident)/_components/ResidentButton";
import ResidentStatusChip, { residentChipStatus } from "@/app/(resident)/_components/ResidentStatusChip";
import { useResidentBillMonths } from "@/hooks/reactquery/residentBilling";
import {
  useResidentBuildingNotice,
  useResidentNoticeReadIds,
  useResidentNotices,
} from "@/hooks/reactquery/residentNotices";
import { useMoveOutRequest } from "@/hooks/reactquery/residentMoveOut";
import { useResidentProfile } from "@/hooks/reactquery/residentProfile";
import { formatWon } from "@/lib/format";

import { residentHomeClasses as styles } from "./homeClasses";

const formatAmount = (amount: number) => formatWon(amount);
const formatPlain = (amount: number) =>
  formatWon(Math.round(amount)).replace(/원$/, "");
const formatDate = (date: string | null) => {
  if (!date) return "미정";
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;
};
const formatPeriod = (period: string) => `${Number(period.slice(5, 7))}월`;
const formatBillLabel = (period: string) =>
  `${period.slice(0, 4)}년 ${Number(period.slice(5, 7))}월 관리비`;
const formatDottedDate = (date: string) =>
  `${date.slice(0, 4)}.${date.slice(5, 7)}.${date.slice(8, 10)}`;
const moveOutDday = (desiredDate: string) => {
  const [year, month, day] = desiredDate.slice(0, 10).split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return "지난 일정";

  const today = new Date();
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const desiredUtc = Date.UTC(year, month - 1, day);
  const days = Math.round((desiredUtc - todayUtc) / 86_400_000);
  return days > 0 ? `D-${days}` : days === 0 ? "D-day" : "지난 일정";
};

const trendBarDelays = [styles.barDelay0, styles.barDelay1, styles.barDelay2];
const trendValueDelays = [
  styles.valueDelay0,
  styles.valueDelay1,
  styles.valueDelay2,
];

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

function NoticeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 8h9l5-3v14l-5-3H4z" />
    </svg>
  );
}

export default function ResidentHomeWorkspace() {
  const profileQuery = useResidentProfile();
  const monthsQuery = useResidentBillMonths();
  const noticesQuery = useResidentNotices();
  const noticeReadIdsQuery = useResidentNoticeReadIds();
  const buildingNoticeQuery = useResidentBuildingNotice();
  const moveOutQuery = useMoveOutRequest();
  const [moveOutOpen, setMoveOutOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);

  const isHomeInitialLoading =
    profileQuery.isPending ||
    monthsQuery.isPending ||
    noticesQuery.isPending ||
    buildingNoticeQuery.isPending ||
    moveOutQuery.isPending;
  const isHomeRefreshing = [
    profileQuery,
    monthsQuery,
    noticesQuery,
    buildingNoticeQuery,
    moveOutQuery,
  ].some((query) => query.isFetching && !query.isPending);
  // 읽음 기록(noticeReadIdsQuery)은 새 공지 점에만 쓴다 — 로딩·오류 판정에 넣지 않는다(0221 적용 전에도 홈이 떠야 함).
  const error = profileQuery.error || monthsQuery.error || noticesQuery.error;

  if (isHomeInitialLoading) {
    return (
      <ResidentAsyncState
        variant="compact"
        role="status"
        message="홈 정보를 불러오고 있어요."
        showSpinner
      />
    );
  }

  if (error) {
    return (
      <ResidentAsyncState
        variant="compact"
        role="alert"
        message={<b>홈 정보를 불러오지 못했어요.</b>}
        retryLabel="다시 시도"
        onRetry={() => {
          void profileQuery.refetch();
          void monthsQuery.refetch();
          void noticesQuery.refetch();
        }}
      />
    );
  }

  const profile = profileQuery.data;
  if (!profile) {
    return (
      <ResidentAsyncState
        variant="compact"
        role="status"
        message={<b>연결된 세대 정보를 찾을 수 없어요.</b>}
      />
    );
  }

  const months = monthsQuery.data ?? [];
  const currentMonth = months[0];
  const lateFee = currentMonth?.lateFee ?? 0;
  const totalBilled = currentMonth ? currentMonth.totalAmount + lateFee : 0;

  const trend = months.slice(0, 3).reverse();
  const trendValues = trend.map((month) => month.totalAmount);
  const trendMax = trendValues.length ? Math.max(...trendValues) : 0;
  const trendMin = trendValues.length ? Math.min(...trendValues) : 0;
  const barHeight = (value: number) =>
    trendMax === trendMin
      ? 82
      : Math.round(42 + ((value - trendMin) / (trendMax - trendMin)) * 48);
  const trendAvg = trend.length
    ? Math.round(
        trendValues.reduce((sum, value) => sum + value, 0) / trend.length,
      )
    : 0;
  const trendCurrent = currentMonth?.totalAmount ?? 0;
  const trendDiff = trendCurrent - trendAvg;
  const showComparison = trend.length >= 2 && trendDiff !== 0;

  const readNoticeIds = new Set(noticeReadIdsQuery.data ?? []);
  const hasNotice = noticeReadIdsQuery.isSuccess && (noticesQuery.data ?? []).some(
    (notice) => !readNoticeIds.has(notice.id),
  );
  // 건물 공지 = 직원이 건물 기본정보에 입력한 「건물 상시 공지문」. 비어 있으면 카드를 그리지 않는다.
  const buildingNotice = buildingNoticeQuery.data;
  // 정본 .mocard: 신청이 살아 있으면(확인 중·확정) 보인다. 취소·반려되면 숨긴다.
  const moveOut = moveOutQuery.data;
  const activeMoveOut =
    moveOut && (moveOut.status === "pending" || moveOut.status === "confirmed")
      ? moveOut
      : null;

  return (
    <div className={styles.page}>
      {isHomeRefreshing ? (
        <div role="status" aria-label="홈 정보 갱신 중" className="fixed right-4 top-4 z-30 rounded-full bg-white px-3 py-2 text-[12px] font-bold text-t3 shadow-card">갱신 중…</div>
      ) : null}
      <header className={styles.header}>
        <div className={styles.unit}>
          <h1>
            {profile.buildingName} {profile.unitNo}
          </h1>
          <p>
            {profile.kakaoName || "사용자"} 님 · {profile.orgName}
          </p>
        </div>
        <Link
          href="/resident/notice"
          className={styles.bell}
          aria-label={hasNotice ? "공지사항, 새 공지 있음" : "공지사항"}
        >
          <BellIcon />
          {hasNotice ? <i className={styles.dot} aria-hidden="true" /> : null}
        </Link>
      </header>

      <main className={styles.scroll}>
        {buildingNotice ? (
          <button
            type="button"
            className={styles.notice}
            onClick={() => setNoticeOpen(true)}
          >
            <span className={styles.noticeIcon}>
              <NoticeIcon />
            </span>
            <span className={styles.noticeText}>
              <b className={styles.noticeTitle}>건물 공지</b>
              <span className={styles.noticePreview}>{buildingNotice}</span>
            </span>
          </button>
        ) : null}

        <section className={styles.bill} aria-labelledby="current-bill-title">
          {currentMonth ? (
            <>
              <div className={styles.billHead}>
                <span className={styles.billLabel} id="current-bill-title">
                  {formatBillLabel(currentMonth.period)}
                </span>
                <ResidentStatusChip
                  paid={
                    currentMonth.payStatus === "paid" ||
                    currentMonth.payStatus === "none"
                  }
                  status={residentChipStatus(currentMonth.payStatus)}
                />
              </div>
              <div className={styles.amount}>
                {formatPlain(totalBilled)}
                <i>원</i>
              </div>
              <div className={styles.due}>
                납부기한 <b>{formatDate(currentMonth.dueDate)}</b>
              </div>
              <div className={styles.divider} />
              <div className={`${styles.li} ${styles.liMain}`}>
                <span>당월 부과액</span>
                <b className={styles.liValue}>{formatAmount(currentMonth.totalAmount)}</b>
              </div>
              {lateFee > 0 ? (
                <div className={`${styles.li} ${styles.liSub}`}>
                  <span>연체료</span>
                  <b className={styles.liSubValue}>{formatAmount(lateFee)}</b>
                </div>
              ) : null}
              <div className={styles.cta}>
                <Link href={`/resident/bill/${currentMonth.period.slice(0, 7)}`} className={styles.ctaPrimary}>
                  상세 내역 보기
                </Link>
              </div>
            </>
          ) : (
            <div className={styles.billEmpty}>
              <b>부과 내역이 없어요.</b>
              <span>관리비가 확정되면 이곳에 표시돼요.</span>
            </div>
          )}
        </section>

        {activeMoveOut ? (
          <button
            type="button"
            className={styles.moveOut}
            onClick={() => setMoveOutOpen(true)}
          >
            <span className={styles.moveOutIcon} aria-hidden="true">
              <svg
                className="size-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19V9l8-5 8 5v10" />
                <path d="M10 19v-6h4v6" />
              </svg>
            </span>
            <span className={styles.moveOutText}>
              <b className={styles.moveOutTitle}>퇴실 신청 확인 중</b>
              <span className={styles.moveOutDate}>
                희망 퇴실일 {formatDottedDate(activeMoveOut.desiredDate)}
              </span>
            </span>
            <span className={styles.moveOutDday}>
              {moveOutDday(activeMoveOut.desiredDate)}
            </span>
          </button>
        ) : null}

        <div className={styles.trendGap} />
        <section className={styles.trend} aria-labelledby="trend-title">
          {trend.length > 0 ? (
            <>
              <div
                className={styles.thead}
                id="trend-title"
              >
                {showComparison ? (
                  <>
                    최근 {trend.length}개월 평균보다
                    <br />
                    <b>
                      <em>{formatAmount(Math.abs(trendDiff))}</em>{" "}
                      {trendDiff > 0 ? "많아요" : "적어요"}
                    </b>
                  </>
                ) : (
                  <>
                    이번 달 관리비는
                    <br />
                    <b>{formatAmount(trendCurrent)}</b>이에요
                  </>
                )}
              </div>
              <div className={styles.tg}>
                {trend.map((month, index) => {
                  const on = index === trend.length - 1;
                  return (
                    <div
                      className={styles.tb}
                      key={month.period}
                    >
                      <div className={styles.plot}>
                        <div
                          className={styles.stack}
                          style={{ height: `${barHeight(month.totalAmount)}%` }}
                        >
                          <div
                            className={[
                              styles.tv,
                              on ? styles.tvOn : styles.tvOff,
                              trendValueDelays[index],
                            ].join(" ")}
                          >
                            {formatPlain(month.totalAmount)}
                          </div>
                          <div
                            className={[
                              styles.tr,
                              on ? styles.trOn : styles.trOff,
                              trendBarDelays[index],
                            ].join(" ")}
                          />
                        </div>
                      </div>
                      <div className={on ? styles.tmOn : styles.tmOff}>
                        {formatPeriod(month.period)}
                      </div>
                    </div>
                  );
                })}
              </div>
              {trend.length >= 2 ? (
                <div className={styles.tfoot}>
                  {trend.length}개월 평균 <b>{formatAmount(trendAvg)}</b> ·
                  이번 달 <b>{formatAmount(trendCurrent)}</b>
                </div>
              ) : null}
            </>
          ) : (
            <p className={styles.trendEmpty}>표시할 관리비 추이가 없어요.</p>
          )}
        </section>
      </main>

      <BottomNav />

      <MoveOutSection
        open={moveOutOpen}
        onClose={() => setMoveOutOpen(false)}
      />

      {/* 건물 공지: 공지 목록·퇴실 신청과 같은 바텀시트(배경·Esc·확인으로 닫기) */}
      <ResidentBottomSheet variant="notice" open={noticeOpen && !!buildingNotice} onDismiss={() => setNoticeOpen(false)}>
        <div role="dialog" aria-modal="true" aria-labelledby="notice-sheet-title" className="flex flex-col">
          <h2 className={styles.sheetTitle} id="notice-sheet-title">
            건물 공지
          </h2>
          <div className={styles.sheetBody}>{buildingNotice}</div>
          <div className={styles.sheetFoot}>
            <ResidentButton variant="primary" size="moveOut" type="button" className="w-full" onClick={() => setNoticeOpen(false)}>
              확인
            </ResidentButton>
          </div>
        </div>
      </ResidentBottomSheet>
    </div>
  );
}
