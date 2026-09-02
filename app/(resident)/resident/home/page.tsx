"use client";

import Link from "next/link";

import BottomNav from "@/app/(resident)/_components/BottomNav";
import MoveOutSection from "@/app/(resident)/_components/MoveOutSection";
import ResidentAsyncState from "@/app/(resident)/_components/ResidentAsyncState";
import { useResidentBillMonths } from "@/hooks/reactquery/residentBilling";
import { useResidentNotices } from "@/hooks/reactquery/residentNotices";
import { useResidentProfile } from "@/hooks/reactquery/residentProfile";
import { formatDate as formatDateValue, formatWon } from "@/lib/format";
import { useResidentGuard } from "@/lib/resident/useResidentGuard";

import styles from "./home.module.css";

const formatAmount = (amount: number) => formatWon(amount);
const formatDate = (date: string | null) =>
  formatDateValue(date, { nullText: "미정" });
const formatPeriod = (period: string) => `${Number(period.slice(5, 7))}월`;

export default function ResidentHomePage() {
  const guard = useResidentGuard();
  const profileQuery = useResidentProfile();
  const monthsQuery = useResidentBillMonths();
  const noticesQuery = useResidentNotices();

  const loading =
    guard.loading ||
    profileQuery.isPending ||
    monthsQuery.isPending ||
    noticesQuery.isPending;
  const error =
    guard.error || profileQuery.error || monthsQuery.error || noticesQuery.error;

  if (loading) {
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
          void guard.retry();
          void profileQuery.refetch();
          void monthsQuery.refetch();
          void noticesQuery.refetch();
        }}
      />
    );
  }

  if (!guard.link) return null;

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
  const trend = months.slice(0, 6).reverse();
  const maxTrendAmount = Math.max(
    ...trend.map((month) => month.totalAmount),
    1,
  );
  const latestNotice = noticesQuery.data?.[0];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p>{profile.buildingName} {profile.unitNo}</p>
        <h1>{profile.tenantName} 님</h1>
        <span>{profile.orgName}</span>
      </header>

      <main className={styles.scroll}>
        <section className={styles.billCard} aria-labelledby="current-bill-title">
          <div className={styles.billTitle}>
            <div>
              <span>{currentMonth ? formatPeriod(currentMonth.period) : "이번 달"}</span>
              <h2 id="current-bill-title">관리비 현황</h2>
            </div>
            <Link href="/resident/bill">상세 내역 보기</Link>
          </div>

          {currentMonth ? (
            <>
              <div className={styles.unpaid}>
                <span>미납액</span>
                <strong>{formatAmount(currentMonth.unpaidAmount)}</strong>
              </div>
              <dl className={styles.billMeta}>
                <div>
                  <dt>납기일</dt>
                  <dd>{formatDate(currentMonth.dueDate)}</dd>
                </div>
                <div>
                  <dt>당월 부과액</dt>
                  <dd>{formatAmount(currentMonth.totalAmount)}</dd>
                </div>
              </dl>
            </>
          ) : (
            <div className={styles.billEmpty}>
              <b>부과 내역이 없어요.</b>
              <span>관리비가 확정되면 이곳에 표시돼요.</span>
            </div>
          )}
        </section>

        {latestNotice ? (
          <Link
            href={`/resident/notice/${latestNotice.id}`}
            className={styles.noticeBanner}
          >
            <span>최근 공지</span>
            <strong>{latestNotice.title}</strong>
            <b aria-hidden="true">›</b>
          </Link>
        ) : (
          <Link href="/resident/notice" className={styles.noticeBanner}>
            <span>공지사항</span>
            <strong>새로운 공지가 없습니다.</strong>
            <b aria-hidden="true">›</b>
          </Link>
        )}

        <section className={styles.trendCard} aria-labelledby="trend-title">
          <div className={styles.sectionHeading}>
            <h2 id="trend-title">최근 관리비 추이</h2>
            <span>최근 {trend.length}개월</span>
          </div>
          {trend.length > 0 ? (
            <div className={styles.trendList}>
              {trend.map((month) => (
                <div className={styles.trendRow} key={month.period}>
                  <span>{formatPeriod(month.period)}</span>
                  <div className={styles.barTrack} aria-hidden="true">
                    <i
                      style={{
                        width: `${Math.max(
                          5,
                          (month.totalAmount / maxTrendAmount) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <b>{formatAmount(month.totalAmount)}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.trendEmpty}>표시할 관리비 추이가 없어요.</p>
          )}
        </section>

        <MoveOutSection />
      </main>

      <BottomNav />
    </div>
  );
}
