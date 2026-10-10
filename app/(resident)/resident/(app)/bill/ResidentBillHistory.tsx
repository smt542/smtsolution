"use client";

import Link from "next/link";
import { useState } from "react";

import type { ResidentBillMonth } from "@/hooks/reactquery/residentBilling/apis";
import { formatWon } from "@/lib/format";
import ResidentStatusChip, { residentChipStatus } from "@/app/(resident)/_components/ResidentStatusChip";

import { billClasses as styles } from "./billClasses";

type ResidentBillHistoryProps = {
  buildingName: string | null;
  unitNo: string | null;
  months: ResidentBillMonth[];
};

const formatAmount = (won: number) => formatWon(won);
const formatPlain = (won: number) =>
  formatWon(Math.round(won)).replace(/원$/, "");
const formatMd = (iso: string) =>
  `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;
const monthLabel = (period: string) => `${Number(period.slice(5, 7))}월`;
const yearOf = (period: string) => period.slice(0, 4);

const isPaid = (month: ResidentBillMonth) =>
  month.payStatus === "paid" || month.payStatus === "none";

/** 아직 내야 할 금액 = 남은 원금 + 연체료(수.연 연체료 미수금 포함). */
const remainingOf = (month: ResidentBillMonth) => month.unpaidAmount + month.lateFee;

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

export default function ResidentBillHistory({
  buildingName,
  unitNo,
  months,
}: ResidentBillHistoryProps) {
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
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
    <>
      <header className={styles.header}>
        <h1 className={styles.h1}>관리비</h1>
        <div className={styles.sub}>
          {buildingName} {unitNo}
        </div>
        {years.length > 0 ? (
          <div className={styles.yr} role="tablist" aria-label="조회 연도">
            {years.map((year) => (
              <button
                type="button"
                role="tab"
                aria-selected={year === activeYear}
                className={
                  year === activeYear
                    ? `${styles.yb} ${styles.ybOn}`
                    : `${styles.yb} ${styles.ybOff}`
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
                const chipStatus = residentChipStatus(month.payStatus);
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
                        ) : chipStatus === "partial" ? (
                          // 일부만 낸 달: 낸 금액과 남은 금액을 나눠 보여 준다(원금을 다 냈으면 연체료만 남음).
                          month.unpaidAmount === 0 ? (
                            <>
                              관리비 납부 · 연체료{" "}
                              <em>{formatAmount(month.lateFee)}</em> 미납
                            </>
                          ) : (
                            <>
                              {formatAmount(month.paidAmount)} 납부 · 남은 금액{" "}
                              <em>{formatAmount(remainingOf(month))}</em>
                            </>
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
                    <ResidentStatusChip paid={paid} status={chipStatus} />
                    <ChevronIcon />
                  </Link>
                );
              })}
            </section>
          </>
        )}
      </main>
    </>
  );
}
