"use client";

import Link from "next/link";

import {
  type ResidentNoticeType,
  useResidentNotices,
} from "@/hooks/reactquery/residentNotices";
import { useResidentGuard } from "@/lib/resident/useResidentGuard";

import styles from "./notice.module.css";

const typeLabel: Record<ResidentNoticeType, string> = {
  normal: "일반",
  important: "중요",
  urgent: "긴급",
};

const formatDate = (date: string) => date.slice(0, 10).replaceAll("-", ".");

export default function ResidentNoticePage() {
  const guard = useResidentGuard();
  const noticesQuery = useResidentNotices();

  if (guard.loading || noticesQuery.isPending) {
    return (
      <div className={styles.center} role="status">
        <span className={styles.spinner} aria-hidden="true" />
        공지사항을 불러오고 있어요.
      </div>
    );
  }

  if (guard.error || noticesQuery.error) {
    return (
      <div className={styles.center} role="alert">
        <b>공지사항을 불러오지 못했어요.</b>
        <button
          type="button"
          onClick={() => {
            void guard.retry();
            void noticesQuery.refetch();
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!guard.link) return null;

  const notices = noticesQuery.data ?? [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/resident/home" aria-label="홈으로 돌아가기">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1>공지사항</h1>
        <span aria-hidden="true" />
      </header>

      <main className={styles.scroll}>
        {notices.length === 0 ? (
          <div className={styles.empty} role="status">
            <b>등록된 내용이 없습니다</b>
            <span>새로운 공지가 등록되면 이곳에서 확인할 수 있어요.</span>
          </div>
        ) : (
          <section className={styles.list} aria-label="공지 목록">
            {notices.map((notice) => (
              <Link href={`/resident/notice/${notice.id}`} key={notice.id}>
                <div className={styles.rowTop}>
                  <span className={`${styles.badge} ${styles[notice.noticeType]}`}>
                    {typeLabel[notice.noticeType]}
                  </span>
                  <time dateTime={notice.publishedAt}>
                    {formatDate(notice.publishedAt)}
                  </time>
                </div>
                <strong>{notice.title}</strong>
                <svg className={styles.chevron} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
