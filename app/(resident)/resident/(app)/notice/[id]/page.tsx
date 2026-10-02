import Link from "next/link";

import MobileBackHeader from "@/app/(resident)/_components/MobileBackHeader";
import NoticeDocument from "@/app/(resident)/_components/NoticeDocument";
import { noticeDetailClasses as styles } from "@/app/(resident)/_components/noticeDetailClasses";

import { getResidentNoticeDetailPageData } from "../data";
import ResidentNoticeRetryState from "../ResidentNoticeRetryState";
import ResidentNoticeReadTracker from "./ResidentNoticeReadTracker";

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
