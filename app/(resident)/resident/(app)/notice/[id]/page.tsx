import Link from "next/link";

import MobileBackHeader from "@/app/(resident)/_components/MobileBackHeader";
import type { ResidentNoticeType } from "@/hooks/reactquery/residentNotices/apis";
import { NoticeContent } from "@/components/notices/NoticeContent";
import { formatDate } from "@/lib/format";

import { getResidentNoticeDetailPageData } from "../data";
import ResidentNoticeRetryState from "../ResidentNoticeRetryState";
import styles from "./detail.module.css";

const typeLabel: Record<ResidentNoticeType, string> = {
  normal: "일반",
  important: "중요",
  urgent: "긴급",
};

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
      href="/resident/notice"
      label="공지 목록으로 돌아가기"
      title="공지사항"
      divider
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
            <span>{detail.buildingName ?? residentBuildingName ?? "전체 공지"}</span>
          </p>
          <NoticeContent json={detail.contentJson} fallbackText={detail.content} imageUrls={imageUrls} className={styles.content} />
        </article>
      </main>
    </div>
  );
}
