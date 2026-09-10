import "server-only";

import type {
  PublicNotice,
  PublicNoticeByTokenResult,
  PublicNoticeRow,
} from "@/hooks/reactquery/residentNotice/apis";
import { createClient } from "@/lib/supabase/server";

const rowToPublicNotice = (row: PublicNoticeRow): PublicNotice => ({
  title: row.title,
  content: row.content,
  noticeType: row.notice_type,
  buildingName: row.building_name,
  publishedAt: row.published_at,
  isExpired: row.is_expired,
});

export async function getPublicNoticeByToken(
  token: string,
): Promise<PublicNoticeByTokenResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_notice_by_token", {
    p_token: token,
  });

  if (error) throw new Error(error.message);
  return data ? rowToPublicNotice(data as PublicNoticeRow) : null;
}
