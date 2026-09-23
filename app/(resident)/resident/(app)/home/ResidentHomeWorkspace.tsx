"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import BottomNav from "@/app/(resident)/_components/BottomNav";
import ResidentAsyncState from "@/app/(resident)/_components/ResidentAsyncState";
import { useResidentBillMonths } from "@/hooks/reactquery/residentBilling";
import {
  useResidentNoticeDetail,
  useResidentNotices,
} from "@/hooks/reactquery/residentNotices";
import { useResidentProfile } from "@/hooks/reactquery/residentProfile";
import { formatWon } from "@/lib/format";

import { residentHomeClasses as styles } from "./homeClasses";
import { ResidentButton } from "@/app/(resident)/_components/ResidentButton";

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

type ChipInfo = { label: string; className: string };
const chipFor = (status: string): ChipInfo => {
  if (status === "paid" || status === "none") {
    return { label: "완납", className: `${styles.chip} ${styles.chipOk}` };
  }
  if (status === "partial") {
    return { label: "부분", className: `${styles.chip} ${styles.chipWarn}` };
  }
  return { label: "미납", className: styles.chip };
};

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
  const latestNotice = noticesQuery.data?.[0];
  const noticeDetailQuery = useResidentNoticeDetail(latestNotice?.id ?? 0);
  const [noticeOpen, setNoticeOpen] = useState(false);

  useEffect(() => {
    if (!noticeOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNoticeOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [noticeOpen]);

  const isHomeInitialLoading =
    profileQuery.isPending || monthsQuery.isPending || noticesQuery.isPending;
  const isHomeRefreshing = [profileQuery, monthsQuery, noticesQuery, noticeDetailQuery]
    .some((query) => query.isFetching && !query.isPending);
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
  const chip = currentMonth ? chipFor(currentMonth.payStatus) : null;

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

  const hasNotice = (noticesQuery.data?.length ?? 0) > 0;
  const noticePreview =
    noticeDetailQuery.data?.content ?? "공지 내용을 확인해 보세요.";

  return (
    <div className={styles.page}>
      {isHomeRefreshing ? (
        <div role="status" aria-label="홈 정보 갱신 중" className="fixed right-4 top-4 z-30 rounded-full bg-white px-3 py-2 text-xs font-bold text-t3 shadow-card">갱신 중…</div>
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
        {latestNotice ? (
          <button
            type="button"
            className={styles.notice}
            onClick={() => setNoticeOpen(true)}
          >
            <span className={styles.noticeIcon}>
              <NoticeIcon />
            </span>
            <span className={styles.noticeText}>
              <b>{latestNotice.title}</b>
              <span>{noticePreview}</span>
            </span>
          </button>
        ) : (
          <Link href="/resident/notice" className={styles.notice}>
            <span className={styles.noticeIcon}>
              <NoticeIcon />
            </span>
            <span className={styles.noticeText}>
              <b>공지사항</b>
              <span>새로운 공지가 없습니다.</span>
            </span>
          </Link>
        )}

        <section className={styles.bill} aria-labelledby="current-bill-title">
          {currentMonth && chip ? (
            <>
              <div className={styles.billHead}>
                <span id="current-bill-title">
                  {formatBillLabel(currentMonth.period)}
                </span>
                <span className={chip.className}>{chip.label}</span>
              </div>
              <div className={styles.amount}>
                {formatPlain(totalBilled)}
                <i>원</i>
              </div>
              <div className={styles.due}>
                납부기한 <b>{formatDate(currentMonth.dueDate)}</b>
              </div>
              <div className={styles.divider} />
              <div className={styles.li}>
                <span>당월 부과액</span>
                <b>{formatAmount(currentMonth.totalAmount)}</b>
              </div>
              {lateFee > 0 ? (
                <div className={`${styles.li} ${styles.liSub}`}>
                  <span>연체료</span>
                  <b>{formatAmount(lateFee)}</b>
                </div>
              ) : null}
              <div className={styles.cta}>
                <Link href="/resident/bill" className={styles.ctaPrimary}>
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

        <div className={styles.trendGap} />
        <section className={styles.trend} aria-labelledby="trend-title">
          {trend.length > 0 ? (
            <>
              <div
                className={
                  showComparison && trendDiff > 0
                    ? `${styles.thead} ${styles.theadRed}`
                    : styles.thead
                }
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
                      className={on ? `${styles.tb} ${styles.tbOn}` : styles.tb}
                      key={month.period}
                    >
                      <div className={styles.plot}>
                        <div
                          className={styles.stack}
                          style={{ height: `${barHeight(month.totalAmount)}%` }}
                        >
                          <div className={styles.tv}>
                            {formatPlain(month.totalAmount)}
                          </div>
                          <div className={styles.tr} />
                        </div>
                      </div>
                      <div className={styles.tm}>
                        {formatPeriod(month.period)}
                      </div>
                    </div>
                  );
                })}
              </div>
              {trend.length >= 2 ? (
                <div className={styles.tfoot}>
                  최근 {trend.length}개월 평균 <b>{formatAmount(trendAvg)}</b> ·
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

      {noticeOpen && latestNotice ? (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="notice-modal-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setNoticeOpen(false);
          }}
        >
          <div className={styles.modalCard}>
            <div className={styles.modalHead}>
              <h2 className={styles.modalTitle} id="notice-modal-title">
                {latestNotice.title}
              </h2>
              {latestNotice.buildingName ? (
                <p className={styles.modalMeta}>{latestNotice.buildingName}</p>
              ) : null}
            </div>
            <div className={styles.modalBody}>
              {noticeDetailQuery.isPending
                ? "공지 내용을 불러오고 있어요."
                : noticeDetailQuery.error
                  ? "공지 내용을 불러오지 못했어요."
                  : (noticeDetailQuery.data?.content ?? "공지 내용이 없어요.")}
            </div>
            <div className={styles.modalFoot}>
              <ResidentButton
                variant="primary"
                type="button"
                className="w-full"
                onClick={() => setNoticeOpen(false)}
              >
                확인
              </ResidentButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
