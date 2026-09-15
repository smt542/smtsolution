import {
  useAttachments,
  useAttachmentSignedUrls,
} from "@/hooks/reactquery/attachments";
import { collectNoticeImagePaths, NOTICE_IMAGE_ENTITY_TYPE } from "@/lib/notice/images";
import type { NoticeDoc } from "@/lib/notice/richText";

export interface NoticeImageUrlsResult {
  urls: Record<string, string>;
  isLoading: boolean;
}

/**
 * 관리자 상세(클라이언트)용 공지 본문 이미지 signed URL 해석.
 * staff는 org_members라 Storage RLS로 직접 서명할 수 있어 공통 첨부 훅을 재사용한다.
 * content_json에 이미지가 없으면 조회를 건너뛴다(entityId 0 → 비활성).
 */
export function useNoticeImageUrls(
  noticeId: number,
  doc: NoticeDoc | null | undefined,
): NoticeImageUrlsResult {
  const hasImages = collectNoticeImagePaths(doc).length > 0;
  const attachmentsQuery = useAttachments(
    NOTICE_IMAGE_ENTITY_TYPE,
    hasImages ? noticeId : 0,
  );
  const rows = attachmentsQuery.data ?? [];
  const signed = useAttachmentSignedUrls(rows, "preview");

  const urls: Record<string, string> = {};
  for (const result of signed) {
    if (result.url) urls[result.attachment.fileUrl] = result.url;
  }

  const isLoading =
    hasImages && (attachmentsQuery.isPending || signed.some((result) => result.isPending));

  return { urls, isLoading };
}
