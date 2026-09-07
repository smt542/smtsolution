"use client";

import Link from "next/link";
import { useState } from "react";

import BottomNav from "@/app/(resident)/_components/BottomNav";
import {
  type ResidentBillMonth,
  useResidentBillMonths,
} from "@/hooks/reactquery/residentBilling";
import { formatWon } from "@/lib/format";
import { useResidentGuard } from "@/lib/resident/useResidentGuard";

import styles from "./bill.module.css";

const formatAmount = (won: number) => formatWon(won);
const formatPlain = (won: number) =>
  formatWon(Math.round(won)).replace(/원$/, "");
const formatMd = (iso: string) =>
  `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;
const monthLabel = (period: string) => `${Number(period.slice(5, 7))}월`;
const yearOf = (period: string) => period.slice(0, 4);

const isPaid = (month: ResidentBillMonth) =>
  month.payStatus === "paid" || month.payStatus === "none";

function ChevronIcon() {
  return (
    <svg
      className={styles.chev}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

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
  const years = Array.from(new Set(months.map((month) => yearOf(month.period))));
  const activeYear =
    selectedYear && years.includes(selectedYear) ? selectedYear : years[0];
  const visibleMonths = activeYear
    ? months.filter((month) => yearOf(month.period) === activeYear)
    : [];

  const yearlyTotal = visibleMonths.reduce(
    (sum, month) => sum + month.totalAmount + month.lateFee,
    0,
  );
  const yearlyAverage = visibleMonths.length
    ? Math.round(yearlyTotal / visibleMonths.length)
    : 0;
  const yearlyUnpaid = visibleMonths.reduce(
    (sum, month) => sum + month.unpaidAmount + month.lateFee,
    0,
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.h1}>관리비</h1>
        <div className={styles.sub}>
          {guard.link.buildingName} {guard.link.unitNo}
        </div>
        {years.length > 0 ? (
          <div className={styles.yr} role="tablist" aria-label="조회 연도">
            {years.map((year) => (
              <button
                type="button"
                role="tab"
                aria-selected={year === activeYear}
                className={
                  year === activeYear ? `${styles.yb} ${styles.ybOn}` : styles.yb
                }
                onClick={() => setSelectedYear(year)}
                key={year}
              >
                {year}년
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <main className={styles.scroll}>
        {months.length === 0 ? (
          <div className={styles.empty} role="status">
            부과 내역이 없어요
          </div>
        ) : (
          <>
            <section className={styles.sum} aria-label={`${activeYear}년 요약`}>
              <div className={styles.sw}>
                <span>{activeYear}년 합계</span>
                <span>{visibleMonths.length}개월</span>
              </div>
              <div className={styles.stot}>
                {formatPlain(yearlyTotal)}
                <i>원</i>
              </div>
              <div className={styles.srow}>
                <div>
                  <span>월 평균</span>
                  <b>{formatAmount(yearlyAverage)}</b>
                </div>
                <div>
                  <span>미납</span>
                  <b>{formatAmount(yearlyUnpaid)}</b>
                </div>
              </div>
            </section>

            <div className={styles.lbl}>
              월별 부과 내역<span>{visibleMonths.length}건</span>
            </div>

            <section className={styles.list} aria-label="월별 부과 내역">
              {visibleMonths.map((month) => {
                const paid = isPaid(month);
                const gross = month.totalAmount + month.lateFee;
                return (
                  <Link
                    href={`/resident/bill/${month.period.slice(0, 7)}`}
                    className={styles.row}
                    key={month.period}
                  >
                    <div className={styles.m}>
                      <b>{monthLabel(month.period)}</b>
                      <span>{yearOf(month.period)}</span>
                    </div>
                    <div className={styles.mid}>
                      <div className={styles.amt}>{formatAmount(gross)}</div>
                      <div className={styles.meta}>
                        {paid ? (
                          month.paidDate ? (
                            `${formatMd(month.paidDate)} 납부`
                          ) : (
                            "완납"
                          )
                        ) : (
                          <>
                            납부기한{" "}
                            {month.dueDate ? formatMd(month.dueDate) : "미정"}
                            {month.lateFee > 0 ? (
                              <>
                                {" · 연체료 "}
                                <em>{formatAmount(month.lateFee)}</em>
                              </>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                    <span
                      className={
                        paid
                          ? `${styles.chip} ${styles.chipPaid}`
                          : `${styles.chip} ${styles.chipDue}`
                      }
                    >
                      {paid ? "완납" : "미납"}
                    </span>
                    <ChevronIcon />
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
