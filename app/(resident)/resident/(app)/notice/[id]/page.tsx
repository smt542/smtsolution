import Link from "next/link";

import MobileBackHeader from "@/app/(resident)/_components/MobileBackHeader";
import NoticeDocument from "@/app/(resident)/_components/NoticeDocument";
import { noticeDetailClasses as styles } from "@/app/(resident)/_components/noticeDetailClasses";

import { getResidentNoticeDetailPageData } from "../data";
import ResidentNoticeRetryState from "../ResidentNoticeRetryState";
import ResidentNoticeReadTracker from "./ResidentNoticeReadTracker";

/**
 * 공지 상세 유입경로 2가지: 홈 상단 공지 캐러셀(?from=home) · 벨 → 공지 목록.
 * 뒤로가기는 들어온 곳으로 돌아간다(경로 표시가 없으면 공지 목록).
 */
export default async function ResidentNoticeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const [{ id: idSegment }, query] = await Promise.all([params, searchParams]);
  const fromHome = (Array.isArray(query.from) ? query.from[0] : query.from) === "home";
  const parsedId = Number(idSegment);
  const id = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : 0;

  const header = (
    <MobileBackHeader
      variant="detail"
      href={fromHome ? "/resident/home" : "/resident/notice"}
      label={fromHome ? "홈으로 돌아가기" : "공지 목록으로 돌아가기"}
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

  return (
    <div className={styles.page}>
      {header}
      <ResidentNoticeReadTracker noticeId={detail.id} />
      <main className={styles.scroll}>
        <NoticeDocument
          noticeType={detail.noticeType}
          title={detail.title}
          publishedAt={detail.publishedAt}
          buildingName={residentBuildingName ?? detail.buildingName}
          contentJson={detail.contentJson}
          content={detail.content}
          imageUrls={imageUrls}
        />
      </main>
    </div>
  );
}
