import Link from "next/link";

import MobileBackHeader from "@/app/(resident)/_components/MobileBackHeader";
import type { ResidentNoticeType } from "@/hooks/reactquery/residentNotices/apis";
import { formatDate } from "@/lib/format";

import { getResidentNotices } from "./data";
import styles from "./notice.module.css";
import ResidentNoticeRetryState from "./ResidentNoticeRetryState";

const typeLabel: Record<ResidentNoticeType, string> = {
  normal: "일반",
  important: "중요",
  urgent: "긴급",
};

export default async function ResidentNoticePage() {
  let notices: Awaited<ReturnType<typeof getResidentNotices>>;
  try {
    notices = await getResidentNotices();
  } catch {
    return (
      <ResidentNoticeRetryState
        className={styles.center}
        message="공지사항을 불러오지 못했어요."
      />
    );
  }

  return (
    <div className={styles.page}>
      <MobileBackHeader
        href="/resident/home"
        label="홈으로 돌아가기"
        title="공지사항"
      />

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
