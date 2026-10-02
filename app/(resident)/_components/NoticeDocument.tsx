import { NoticeContent } from "@/components/notices/NoticeContent";
import { formatDate } from "@/lib/format";
import type { NoticeDoc } from "@/lib/notice/richText";

import ResidentGuestCta from "./ResidentGuestCta";
import { noticeDetailClasses as styles } from "./noticeDetailClasses";

type NoticeKind = "normal" | "important" | "urgent";

const typeLabel: Record<NoticeKind, string> = {
  normal: "일반",
  important: "중요",
  urgent: "긴급",
};

function NoticeKindIcon() {
  return (
    <svg
      className="size-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17v.4" />
    </svg>
  );
}

type NoticeDocumentProps = {
  noticeType: NoticeKind;
  title: string;
  publishedAt: string | null;
  buildingName: string | null;
  contentJson: NoticeDoc | null;
  content: string | null;
  imageUrls: Record<string, string>;
  /** 비로그인 공개 링크(정본 `.guest`) — 상단바에 제목이 없어 공지 제목이 h1이고, 앱 안내 카드·만료 안내가 붙는다. */
  guest?: boolean;
};

/** 공지 상세 본문(정본 resident-notice-detail `.doc`). 세입자 앱 공지 상세와 비로그인 공개 링크가 같이 쓴다. */
export default function NoticeDocument({
  noticeType,
  title,
  publishedAt,
  buildingName,
  contentJson,
  content,
  imageUrls,
  guest = false,
}: NoticeDocumentProps) {
  const Title = guest ? "h1" : "h2";

  return (
    <article>
      <span className={`${styles.tag} ${styles[noticeType]}`}>
        {noticeType !== "normal" ? <NoticeKindIcon /> : null}
        {typeLabel[noticeType]}
      </span>
      <Title className={styles.title}>{title}</Title>
      <p className={styles.metadata}>
        {publishedAt ? (
          <time className="tabular-nums" dateTime={publishedAt}>
            {formatDate(publishedAt)}
          </time>
        ) : null}
        {publishedAt && buildingName ? <span aria-hidden="true">·</span> : null}
        {buildingName ? <span>{buildingName} 관리사무소</span> : null}
      </p>
      <NoticeContent
        json={contentJson}
        fallbackText={content}
        imageUrls={imageUrls}
        className={guest ? styles.guestContent : styles.content}
      />
      {guest ? (
        <>
          <ResidentGuestCta
            className="mt-6"
            title="관리비도 앱에서 확인하세요"
            description="이번 달 부과 금액과 항목별 내역을 카카오 로그인 한 번으로 볼 수 있어요."
          />
          <p className={styles.note}>이 링크는 공지 확인 전용이며 일정 기간이 지나면 만료됩니다.</p>
        </>
      ) : null}
    </article>
  );
}
