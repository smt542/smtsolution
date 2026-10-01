import Link from "next/link";

import MobileBackHeader from "@/app/(resident)/_components/MobileBackHeader";
import type { ResidentNoticeType } from "@/hooks/reactquery/residentNotices/apis";
import { formatDate } from "@/lib/format";

import { getResidentNotices } from "./data";
import { noticeClasses as styles } from "./noticeClasses";
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
        variant="list"
        href="/resident/home"
        label="홈으로 돌아가기"
        title="공지"
      />

      <main className={styles.scroll}>
        {notices.length === 0 ? (
          <div className={styles.empty} role="status">
            <b>등록된 내용이 없습니다</b>
            <span>새로운 공지가 등록되면 이곳에서 확인할 수 있어요.</span>
          </div>
        ) : (
          <section className={styles.list} aria-label="공지 목록">
            {notices.map((notice) => {
              const iconClass =
                notice.noticeType === "normal"
                  ? styles.iconNormal
                  : styles.iconWarning;
              const kindClass =
                notice.noticeType === "normal"
                  ? styles.kindNormal
                  : notice.noticeType === "important"
                    ? styles.kindImportant
                    : styles.kindUrgent;

              return (
                <Link
                  href={`/resident/notice/${notice.id}`}
                  className={styles.row}
                  key={notice.id}
                >
                  <span className={iconClass}>
                    <svg
                      className="size-[18px]"
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
                  </span>
                  <span className={styles.text}>
                    <span className={styles.top}>
                      <span className={kindClass}>{typeLabel[notice.noticeType]}</span>
                      {!notice.isRead ? (
                        <i className={styles.unreadBadge} role="img" aria-label="읽지 않은 공지" />
                      ) : null}
                    </span>
                    <strong className={styles.title}>{notice.title}</strong>
                    {notice.preview ? (
                      <span className={styles.preview}>{notice.preview}</span>
                    ) : null}
                    <time
                      className={styles.date}
                      dateTime={notice.publishedAt}
                    >
                      {formatDate(notice.publishedAt)}
                    </time>
                  </span>
                </Link>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
