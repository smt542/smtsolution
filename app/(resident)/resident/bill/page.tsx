"use client";

import Link from "next/link";
import { useState } from "react";

import BottomNav from "@/app/(resident)/_components/BottomNav";
import {
  type ResidentBillPayStatus,
  useResidentBillMonths,
} from "@/hooks/reactquery/residentBilling";
import { formatMonth, formatWon } from "@/lib/format";
import { useResidentGuard } from "@/lib/resident/useResidentGuard";

import styles from "./bill.module.css";

const formatAmount = (amount: number) =>
  formatWon(amount);

const statusLabel: Record<ResidentBillPayStatus, string> = {
  paid: "완납",
  partial: "부분",
  unpaid: "미납",
  none: "미납",
};

export default function ResidentBillPage() {
  const guard = useResidentGuard();
  const monthsQuery = useResidentBillMonths();
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  if (guard.loading || monthsQuery.isPending) {
    return (
      <div className={styles.center} role="status">
        <span className={styles.spinner} aria-hidden="true" />
        <span>관리비 내역을 불러오고 있어요</span>
      </div>
    );
  }

  if (guard.error || monthsQuery.error) {
    return (
      <div className={styles.center} role="alert">
        <b>관리비 내역을 불러오지 못했어요</b>
        <button
          type="button"
          onClick={() => {
            void guard.retry();
            void monthsQuery.refetch();
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!guard.link) return null;

  const months = monthsQuery.data ?? [];
  const years = Array.from(
    new Set(months.map((month) => month.period.slice(0, 4))),
  );
  const activeYear =
    selectedYear && years.includes(selectedYear) ? selectedYear : years[0];
  const visibleMonths = activeYear
    ? months.filter((month) => month.period.startsWith(activeYear))
    : [];
  const yearlyTotal = visibleMonths.reduce(
    (sum, month) => sum + month.totalAmount,
    0,
  );
  const yearlyAverage = visibleMonths.length
    ? Math.round(yearlyTotal / visibleMonths.length)
    : 0;
  const yearlyUnpaid = visibleMonths.reduce(
    (sum, month) => sum + month.unpaidAmount,
    0,
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p>{guard.link.buildingName} {guard.link.unitNo}</p>
          <h1>관리비 내역</h1>
        </div>
        {years.length > 0 ? (
          <label className={styles.yearSelect}>
            <span className={styles.srOnly}>조회 연도</span>
            <select
              value={activeYear}
              onChange={(event) => setSelectedYear(event.target.value)}
            >
              {years.map((year) => (
                <option value={year} key={year}>
                  {year}년
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>

      <main className={styles.scroll}>
        {months.length === 0 ? (
          <div className={styles.empty} role="status">
            <b>부과 내역이 없어요</b>
            <span>관리비가 확정되면 이곳에서 확인할 수 있어요.</span>
          </div>
        ) : (
          <>
            <section className={styles.summary} aria-label={`${activeYear}년 요약`}>
              <div>
                <span>연 합계</span>
                <b>{formatAmount(yearlyTotal)}</b>
              </div>
              <div>
                <span>월 평균</span>
                <b>{formatAmount(yearlyAverage)}</b>
              </div>
              <div>
                <span>미납 총합</span>
                <b className={yearlyUnpaid > 0 ? styles.emphasis : undefined}>
                  {formatAmount(yearlyUnpaid)}
                </b>
              </div>
            </section>

            <section className={styles.list} aria-labelledby="monthly-bills-title">
              <h2 id="monthly-bills-title">월별 내역</h2>
              {visibleMonths.map((month) => {
                const period = month.period.slice(0, 7);
                return (
                  <Link href={`/resident/bill/${period}`} key={month.period}>
                    <div className={styles.rowTop}>
                      <b>{formatMonth(period)}</b>
                      <span
                        className={`${styles.badge} ${styles[month.payStatus]}`}
                      >
                        {statusLabel[month.payStatus]}
                      </span>
                    </div>
                    <dl>
                      <div>
                        <dt>부과액</dt>
                        <dd>{formatAmount(month.totalAmount)}</dd>
                      </div>
                      <div>
                        <dt>미납액</dt>
                        <dd>{formatAmount(month.unpaidAmount)}</dd>
                      </div>
                    </dl>
                  </Link>
                );
              })}
            </section>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
