"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import {
  type PublicNoticeType,
  usePublicNoticeByToken,
} from "@/hooks/reactquery/residentNotice";

import styles from "../../share.module.css";

const noticeTypeLabels: Record<PublicNoticeType, string> = {
  normal: "일반 공지",
  important: "중요 공지",
  urgent: "긴급 공지",
};

const formatDate = (value: string) =>
  value.slice(0, 10).replaceAll("-", ".");

export default function PublicNoticePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const noticeQuery = usePublicNoticeByToken(token);

  if (noticeQuery.isPending) {
    return (
      <div className={styles.center} role="status">
        공지사항을 불러오고 있어요.
      </div>
    );
  }

  if (noticeQuery.error) {
    return (
      <div className={styles.center} role="alert">
        <b>공지사항을 불러오지 못했어요.</b>
        <button type="button" onClick={() => void noticeQuery.refetch()}>
          다시 시도
        </button>
      </div>
    );
  }

  if (!noticeQuery.data) {
    return (
      <div className={styles.center} role="alert">
        <b>유효하지 않은 링크예요.</b>
        <p>공유 링크를 다시 확인해 주세요.</p>
      </div>
    );
  }

  if (noticeQuery.data.isExpired) {
    return (
      <div className={styles.center} role="alert">
        <b>만료된 링크예요.</b>
        <p>관리사무소에 새 링크를 요청해 주세요.</p>
      </div>
    );
  }

  const notice = noticeQuery.data;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.brand}>관리비ON</span>
        <span>공개 공지사항</span>
      </header>
      <main className={styles.scroll}>
        <article className={styles.card}>
          <p className={styles.eyebrow}>
            {notice.noticeType
              ? noticeTypeLabels[notice.noticeType]
              : "공지사항"}
          </p>
          <h1 className={styles.title}>{notice.title}</h1>
          <p className={styles.meta}>
            {[notice.buildingName, notice.publishedAt
              ? formatDate(notice.publishedAt)
              : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className={styles.content}>{notice.content}</p>
        </article>
        <Link className={styles.cta} href="/resident/login">
          관리비ON 시작하기
        </Link>
      </main>
    </div>
  );
}
