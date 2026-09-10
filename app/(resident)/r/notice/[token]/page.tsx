import PublicShareArticleCard from "@/app/(resident)/_components/PublicShareArticleCard";
import PublicTokenPageShell from "@/app/(resident)/_components/PublicTokenPageShell";
import ResidentAsyncState from "@/app/(resident)/_components/ResidentAsyncState";
import type { PublicNoticeType } from "@/hooks/reactquery/residentNotice/apis";
import { formatDate } from "@/lib/format";

import { getPublicNoticeByToken } from "./data";
import PublicNoticeRetryState from "./PublicNoticeRetryState";
import styles from "../../share.module.css";

const noticeTypeLabels: Record<PublicNoticeType, string> = {
  normal: "일반 공지",
  important: "중요 공지",
  urgent: "긴급 공지",
};

export default async function PublicNoticePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let notice;
  try {
    notice = await getPublicNoticeByToken(token);
  } catch {
    return <PublicNoticeRetryState />;
  }

  if (!notice) {
    return (
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
    );
  }

  if (notice.isExpired) {
    return (
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
    );
  }

  return (
    <PublicTokenPageShell
      brand="관리비ON"
      subtitle="공개 공지사항"
      ctaLabel="관리비ON 시작하기"
    >
      <PublicShareArticleCard
        eyebrow={notice.noticeType ? noticeTypeLabels[notice.noticeType] : "공지사항"}
        title={notice.title}
        metadata={[notice.buildingName, notice.publishedAt ? formatDate(notice.publishedAt) : null]
          .filter(Boolean)
          .join(" · ")}
      >
        <p className={styles.content}>{notice.content}</p>
      </PublicShareArticleCard>
    </PublicTokenPageShell>
  );
}
