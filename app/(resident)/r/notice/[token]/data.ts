import "server-only";

import type {
  PublicNotice,
  PublicNoticeByTokenResult,
  PublicNoticeRow,
} from "@/hooks/reactquery/residentNotice/apis";
import { collectNoticeImagePaths } from "@/lib/notice/images";
import { resolveNoticeImageUrls } from "@/lib/notice/serverImages";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const rowToPublicNotice = (row: PublicNoticeRow): PublicNotice => ({
  title: row.title,
  content: row.content,
  contentJson: row.content_json ?? null,
  noticeType: row.notice_type,
  buildingName: row.building_name,
  publishedAt: row.published_at,
  isExpired: row.is_expired,
});

export interface PublicNoticePageData {
  notice: PublicNoticeByTokenResult;
  imageUrls: Record<string, string>;
}

export async function getPublicNoticeByToken(token: string): Promise<PublicNoticePageData> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_notice_by_token", {
    p_token: token,
  });

  if (error) throw new Error(error.message);
  const notice = data ? rowToPublicNotice(data as PublicNoticeRow) : null;

  // 만료·무효 링크이거나 본문 이미지가 없으면 서명(및 service_role 조회)을 건너뛴다.
  if (
    !notice ||
    notice.isExpired ||
    !notice.contentJson ||
    collectNoticeImagePaths(notice.contentJson).length === 0
  ) {
    return { notice, imageUrls: {} };
  }

  // 공개 RPC는 notice id를 반환하지 않으므로 service_role로 토큰→notice_id를 조회한다.
  // RPC와 동일한 만료 게이트를 다시 적용해 만료 링크의 이미지 서명을 차단한다.
  let imageUrls: Record<string, string> = {};
  try {
    const admin = createAdminClient();
    const { data: tokenRow } = await admin
      .from("notice_share_tokens")
      .select("notice_id, expires_at")
      .eq("token", token)
      .maybeSingle();
    const notExpired =
      tokenRow?.expires_at != null && new Date(tokenRow.expires_at).getTime() > Date.now();
    if (tokenRow?.notice_id != null && notExpired) {
      imageUrls = await resolveNoticeImageUrls({
        noticeId: Number(tokenRow.notice_id),
        doc: notice.contentJson,
      });
    }
  } catch {
    imageUrls = {};
  }

  return { notice, imageUrls };
}
