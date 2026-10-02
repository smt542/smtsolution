import NoticeDocument from "@/app/(resident)/_components/NoticeDocument";
import ResidentAsyncState from "@/app/(resident)/_components/ResidentAsyncState";
import { noticeDetailClasses as styles } from "@/app/(resident)/_components/noticeDetailClasses";

import { getPublicNoticeByToken } from "./data";
import PublicNoticeFrame from "./PublicNoticeFrame";
import PublicNoticeRetryState from "./PublicNoticeRetryState";

export default async function PublicNoticePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let notice;
  let imageUrls: Record<string, string> = {};
  try {
    ({ notice, imageUrls } = await getPublicNoticeByToken(token));
  } catch {
    return (
      <PublicNoticeFrame>
        <PublicNoticeRetryState />
      </PublicNoticeFrame>
    );
  }

  if (!notice) {
    return (
      <PublicNoticeFrame>
        <ResidentAsyncState
          variant="public"
          role="alert"
          message={
            <>
              <b>유효하지 않은 링크예요.</b>
              <p>공유 링크를 다시 확인해 주세요.</p>
            </>
          }
        />
      </PublicNoticeFrame>
    );
  }

  if (notice.isExpired) {
    return (
      <PublicNoticeFrame>
        <ResidentAsyncState
          variant="public"
          role="alert"
          message={
            <>
              <b>만료된 링크예요.</b>
              <p>관리사무소에 새 링크를 요청해 주세요.</p>
            </>
          }
        />
      </PublicNoticeFrame>
    );
  }

  return (
    <PublicNoticeFrame>
      <main className={styles.scroll}>
        <NoticeDocument
          guest
          noticeType={notice.noticeType ?? "normal"}
          title={notice.title ?? ""}
          publishedAt={notice.publishedAt}
          buildingName={notice.buildingName}
          contentJson={notice.contentJson}
          content={notice.content}
          imageUrls={imageUrls}
        />
      </main>
    </PublicNoticeFrame>
  );
}
