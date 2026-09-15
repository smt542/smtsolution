import "server-only";

import { imageMimeTypeFromFileName } from "@/lib/attachments/policy";
import {
  SIGNED_URL_EXPIRES_IN_SECONDS,
  signedUrlOptions,
} from "@/lib/attachments/signedUrl";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  collectNoticeImagePaths,
  isNoticeImagePath,
  NOTICE_ATTACHMENTS_BUCKET,
  NOTICE_IMAGE_ENTITY_TYPE,
} from "@/lib/notice/images";
import type { NoticeDoc } from "@/lib/notice/richText";

type NoticeAttachmentRow = {
  file_url: string;
  mime_type: string | null;
  org_id: number;
};

/**
 * 입주자 앱·공유 링크(서버 컴포넌트)용 공지 본문 이미지 signed URL 해석.
 *
 * 세입자(res_claims)·anon은 org_members가 아니라 Storage RLS로 서명할 수 없다. 이미 열람이
 * 인가된 공지(noticeId)에 한해 service_role로 서명하되, 다음 신뢰 경계로 교차 org 유출을 막는다:
 *  - 서명 대상은 해당 공지의 attachments row로 한정(entity_type='notice', entity_id=noticeId).
 *  - content_json이 실제로 참조하는 path와 교집합만 서명(본문에 없는 이미지 서명 금지).
 *  - 각 row의 신뢰된 org_id와 object path 첫 세그먼트가 일치하는지 검증(타 org 경로 차단).
 * 항목별로 실패를 격리하며, 실패한 이미지는 맵에서 빠져 렌더러가 대체 표시를 한다.
 */
export async function resolveNoticeImageUrls(params: {
  noticeId: number;
  doc: NoticeDoc | null | undefined;
}): Promise<Record<string, string>> {
  const { noticeId, doc } = params;
  const contentPaths = new Set(collectNoticeImagePaths(doc));
  if (!noticeId || contentPaths.size === 0) return {};

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("attachments")
    .select("file_url, mime_type, org_id")
    .eq("entity_type", NOTICE_IMAGE_ENTITY_TYPE)
    .eq("entity_id", noticeId);
  if (error || !data) return {};

  const rows = (data as NoticeAttachmentRow[]).filter(
    (row) => contentPaths.has(row.file_url) && isNoticeImagePath(row.file_url, row.org_id),
  );
  if (rows.length === 0) return {};

  const storage = admin.storage.from(NOTICE_ATTACHMENTS_BUCKET);
  const urls: Record<string, string> = {};
  await Promise.all(
    rows.map(async (row) => {
      try {
        const options = signedUrlOptions({
          preset: "preview",
          mimeType: row.mime_type ?? imageMimeTypeFromFileName(row.file_url),
        });
        const result = options
          ? await storage.createSignedUrl(row.file_url, SIGNED_URL_EXPIRES_IN_SECONDS, options)
          : await storage.createSignedUrl(row.file_url, SIGNED_URL_EXPIRES_IN_SECONDS);
        if (!result.error && result.data?.signedUrl) {
          urls[row.file_url] = result.data.signedUrl;
        }
      } catch {
        // 항목별 실패는 무시하고 나머지 이미지는 계속 서명한다.
      }
    }),
  );
  return urls;
}
