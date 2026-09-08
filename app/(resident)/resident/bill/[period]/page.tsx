"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import BillDetailView from "@/app/(resident)/_components/BillDetailView";
import {
  useCreateBillToken,
  useResidentBillDetail,
} from "@/hooks/reactquery/residentBilling";
import { useResidentGuard } from "@/lib/resident/useResidentGuard";

import styles from "./detail.module.css";

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "2026년 7월 관리비" — 정본 상단바 타이틀. period = "YYYY-MM-01". */
const monthTitle = (period: string) =>
  `${period.slice(0, 4)}년 ${Number(period.slice(5, 7))}월 관리비`;

export default function ResidentBillDetailPage() {
  const router = useRouter();
  const params = useParams<{ period: string }>();
  const segment = params.period;
  const period = PERIOD_PATTERN.test(segment) ? `${segment}-01` : "";
  const guard = useResidentGuard();
  const detailQuery = useResidentBillDetail(period);
  const tokenMutation = useCreateBillToken();
  const timer = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  if (guard.loading || (period && detailQuery.isPending)) {
    return (
      <div className={styles.center} role="status">
        관리비 상세를 불러오고 있어요
      </div>
    );
  }

  if (!period) {
    return (
      <div className={styles.center} role="alert">
        유효하지 않은 관리비 기간입니다.
      </div>
    );
  }

  if (guard.error || detailQuery.error) {
    return (
      <div className={styles.center} role="alert">
        <b>관리비 상세를 불러오지 못했어요</b>
        <button
          type="button"
          onClick={() => {
            void guard.retry();
            void detailQuery.refetch();
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!guard.link) return null;

  const copyPublicLink = async () => {
    try {
      const token = await tokenMutation.mutateAsync(period);
      await navigator.clipboard.writeText(`${window.location.origin}/r/${token}`);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setCopied(false);
        timer.current = null;
      }, 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" aria-label="뒤로가기" onClick={() => router.back()}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1>{monthTitle(period)}</h1>
        <span aria-hidden="true" />
      </header>

      <main className={styles.scroll}>
        {!detailQuery.data ? (
          <div className={styles.empty} role="status">
            <b>부과 내역이 없어요</b>
            <span>선택한 달의 확정된 관리비가 없습니다.</span>
          </div>
        ) : (
          <>
            <BillDetailView mode="authed" detail={detailQuery.data} />
            <button
              type="button"
              className={styles.shareButton}
              disabled={tokenMutation.isPending}
              onClick={() => void copyPublicLink()}
            >
              {tokenMutation.isPending
                ? "링크 만드는 중..."
                : copied
                  ? "복사되었습니다"
                  : "무로그인 링크 복사"}
            </button>
            {tokenMutation.error ? (
              <p className={styles.shareError} role="alert">
                공유 링크를 만들지 못했어요. 다시 시도해 주세요.
              </p>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
