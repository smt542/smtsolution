import { createClient } from "@/lib/supabase/client";

export type ResidentNoticeType = "normal" | "important" | "urgent";

export interface ResidentNoticeRow {
  id: number;
  title: string;
  notice_type: ResidentNoticeType;
  building_id: number | null;
  building_name: string | null;
  published_at: string;
  created_at: string;
}

export interface ResidentNotice {
  id: number;
  title: string;
  noticeType: ResidentNoticeType;
  buildingId: number | null;
  buildingName: string | null;
  publishedAt: string;
  createdAt: string;
}

export interface ResidentNoticeDetailRow extends ResidentNoticeRow {
  content: string;
}

export interface ResidentNoticeDetail extends ResidentNotice {
  content: string;
}

export type ResidentNoticesResult = ResidentNotice[];
export type ResidentNoticeDetailResult = ResidentNoticeDetail | null;

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
});

export async function residentNotices(): Promise<ResidentNoticesResult> {
  const { data, error } = await createClient().rpc("resident_notices");
  if (error) throw new Error(error.message);
  return ((data ?? []) as ResidentNoticeRow[]).map(rowToNotice);
}

export async function residentNoticeDetail(
  id: number,
): Promise<ResidentNoticeDetailResult> {
  const { data, error } = await createClient().rpc("resident_notice_detail", {
    p_id: id,
  });
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as ResidentNoticeDetailRow[])[0];
  return row ? rowToNoticeDetail(row) : null;
}
