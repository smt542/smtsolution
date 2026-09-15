import "server-only";

import type {
  ResidentNotice,
  ResidentNoticeDetail,
  ResidentNoticeDetailRow,
  ResidentNoticeRow,
} from "@/hooks/reactquery/residentNotices/apis";
import { createClient } from "@/lib/supabase/server";

type ResidentLinkRow = {
  building_name: string | null;
};

const rowToNotice = (row: ResidentNoticeRow): ResidentNotice => ({
  id: row.id,
  title: row.title,
  noticeType: row.notice_type,
  buildingId: row.building_id,
  buildingName: row.building_name,
  publishedAt: row.published_at,
  createdAt: row.created_at,
});

const rowToNoticeDetail = (
  row: ResidentNoticeDetailRow,
): ResidentNoticeDetail => ({
  ...rowToNotice(row),
  content: row.content,
  contentJson: row.content_json ?? null,
});

export async function getResidentNotices(): Promise<ResidentNotice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resident_notices");

  if (error) throw new Error(error.message);
  return ((data ?? []) as ResidentNoticeRow[]).map(rowToNotice);
}

export async function getResidentNoticeDetailPageData(id: number): Promise<{
  detail: ResidentNoticeDetail | null;
  residentBuildingName: string | null;
}> {
  const supabase = await createClient();
  const [detailResult, linkResult] = await Promise.all([
    supabase.rpc("resident_notice_detail", { p_id: id }),
    supabase.rpc("resident_my_link"),
  ]);

  if (detailResult.error) throw new Error(detailResult.error.message);
  if (linkResult.error) throw new Error(linkResult.error.message);

  const detailRow = ((detailResult.data ?? []) as ResidentNoticeDetailRow[])[0];
  const linkRow = ((linkResult.data ?? []) as ResidentLinkRow[])[0];

  return {
    detail: detailRow ? rowToNoticeDetail(detailRow) : null,
    residentBuildingName: linkRow?.building_name ?? null,
  };
}
