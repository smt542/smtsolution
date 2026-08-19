"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import {
  type ResidentNoticeType,
  useResidentNoticeDetail,
} from "@/hooks/reactquery/residentNotices";
import { useResidentGuard } from "@/lib/resident/useResidentGuard";

import styles from "./detail.module.css";

const typeLabel: Record<ResidentNoticeType, string> = {
  normal: "일반",
  important: "중요",
  urgent: "긴급",
};

const formatDate = (date: string) => date.slice(0, 10).replaceAll("-", ".");

export default function ResidentNoticeDetailPage() {
  const params = useParams<{ id: string }>();
  const parsedId = Number(params.id);
  const id = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : 0;
  const guard = useResidentGuard();
  const detailQuery = useResidentNoticeDetail(id);

  const header = (
    <header className={styles.header}>
      <Link href="/resident/notice" aria-label="공지 목록으로 돌아가기">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Link>
      <h1>공지사항</h1>
      <span aria-hidden="true" />
    </header>
  );

  if (guard.loading || (id > 0 && detailQuery.isPending)) {
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.center} role="status">공지를 불러오고 있어요.</div>
      </div>
    );
  }

  if (guard.error || detailQuery.error) {
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.center} role="alert">
          <b>공지를 불러오지 못했어요.</b>
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
      </div>
    );
  }

  if (!guard.link) return null;

  const detail = detailQuery.data;
  if (!id || !detail) {
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.center} role="status">
          <b>공지 내용을 찾을 수 없어요.</b>
          <Link href="/resident/notice">공지 목록 보기</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {header}
      <main className={styles.scroll}>
        <article className={styles.article}>
          <span className={`${styles.badge} ${styles[detail.noticeType]}`}>
            {typeLabel[detail.noticeType]}
          </span>
          <h2>{detail.title}</h2>
          <p className={styles.metadata}>
            <time dateTime={detail.publishedAt}>{formatDate(detail.publishedAt)}</time>
            <span aria-hidden="true">·</span>
            <span>{detail.buildingName ?? guard.link.buildingName ?? "전체 공지"}</span>
          </p>
          <div className={styles.content}>{detail.content}</div>
        </article>
      </main>
    </div>
  );
}
