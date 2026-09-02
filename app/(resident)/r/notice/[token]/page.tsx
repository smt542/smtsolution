"use client";

import { useParams } from "next/navigation";

import PublicShareArticleCard from "@/app/(resident)/_components/PublicShareArticleCard";
import PublicTokenPageShell from "@/app/(resident)/_components/PublicTokenPageShell";
import ResidentAsyncState from "@/app/(resident)/_components/ResidentAsyncState";
import {
  type PublicNoticeType,
  usePublicNoticeByToken,
} from "@/hooks/reactquery/residentNotice";
import { formatDate } from "@/lib/format";

import styles from "../../share.module.css";

const noticeTypeLabels: Record<PublicNoticeType, string> = {
  normal: "일반 공지",
  important: "중요 공지",
  urgent: "긴급 공지",
};

export default function PublicNoticePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const noticeQuery = usePublicNoticeByToken(token);

  if (noticeQuery.isPending) {
    return (
      <ResidentAsyncState
        variant="public"
        role="status"
        message="공지사항을 불러오고 있어요."
      />
    );
  }

  if (noticeQuery.error) {
    return (
      <ResidentAsyncState
        variant="public"
        role="alert"
        message={<b>공지사항을 불러오지 못했어요.</b>}
        retryLabel="다시 시도"
        onRetry={() => void noticeQuery.refetch()}
      />
    );
  }

  if (!noticeQuery.data) {
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

  if (noticeQuery.data.isExpired) {
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

  const notice = noticeQuery.data;

  return (
    <PublicTokenPageShell
      brand="관리비ON"
      subtitle="공개 공지사항"
      ctaLabel="관리비ON 시작하기"
    >
      <PublicShareArticleCard
        eyebrow={
          notice.noticeType ? noticeTypeLabels[notice.noticeType] : "공지사항"
        }
        title={notice.title}
        metadata={[
          notice.buildingName,
          notice.publishedAt ? formatDate(notice.publishedAt) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      >
        <p className={styles.content}>{notice.content}</p>
      </PublicShareArticleCard>
    </PublicTokenPageShell>
  );
}
