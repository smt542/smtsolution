import Link from "next/link";

import MobileBackHeader from "@/app/(resident)/_components/MobileBackHeader";
import type { ResidentNoticeType } from "@/hooks/reactquery/residentNotices/apis";
import { NoticeContent } from "@/components/notices/NoticeContent";
import { formatDate } from "@/lib/format";

import { getResidentNoticeDetailPageData } from "../data";
import ResidentNoticeRetryState from "../ResidentNoticeRetryState";
import { noticeDetailClasses as styles } from "./detailClasses";

const typeLabel: Record<ResidentNoticeType, string> = {
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

export default async function ResidentNoticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idSegment } = await params;
  const parsedId = Number(idSegment);
  const id = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : 0;

  const header = (
    <MobileBackHeader
      variant="detail"
      href="/resident/notice"
      label="공지 목록으로 돌아가기"
      title="공지"
    />
  );

  if (!id) {
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

  let pageData: Awaited<ReturnType<typeof getResidentNoticeDetailPageData>>;
  try {
    pageData = await getResidentNoticeDetailPageData(id);
  } catch {
    return (
      <div className={styles.page}>
        {header}
        <ResidentNoticeRetryState
          className={styles.center}
          message="공지를 불러오지 못했어요."
        />
      </div>
    );
  }

  const { detail, residentBuildingName, imageUrls } = pageData;
  if (!detail) {
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

  const buildingName = residentBuildingName ?? detail.buildingName;
  const isHighlighted = detail.noticeType !== "normal";

  return (
    <div className={styles.page}>
      {header}
      <main className={styles.scroll}>
        <article>
          <span className={`${styles.tag} ${styles[detail.noticeType]}`}>
            {isHighlighted ? <NoticeKindIcon /> : null}
            {typeLabel[detail.noticeType]}
          </span>
          <h2 className={styles.title}>{detail.title}</h2>
          <p className={styles.metadata}>
            <time className="tabular-nums" dateTime={detail.publishedAt}>
              {formatDate(detail.publishedAt)}
            </time>
            {buildingName ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{buildingName} 관리사무소</span>
              </>
            ) : null}
          </p>
          <NoticeContent
            json={detail.contentJson}
            fallbackText={detail.content}
            imageUrls={imageUrls}
            className={styles.content}
          />
        </article>
      </main>
    </div>
  );
}
