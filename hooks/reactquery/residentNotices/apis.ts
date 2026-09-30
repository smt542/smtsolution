import { createClient } from "@/lib/supabase/client";

import type { NoticeDoc } from "@/lib/notice/richText";

export type ResidentNoticeType = "normal" | "important" | "urgent";

export interface ResidentNoticeRow {
  id: number;
  title: string;
  notice_type: ResidentNoticeType;
  building_id: number | null;
  building_name: string | null;
  published_at: string;
  created_at: string;
  /** 목록(resident_notices)만 준다 — 본문 평문 앞 120자(0213). 상세 RPC엔 없음 */
  preview?: string | null;
}

export interface ResidentNotice {
  id: number;
  title: string;
  noticeType: ResidentNoticeType;
  buildingId: number | null;
  buildingName: string | null;
  publishedAt: string;
  createdAt: string;
  preview: string | null;
}

export interface ResidentNoticeDetailRow extends ResidentNoticeRow {
  content: string;
  content_json: NoticeDoc | null;
}

export interface ResidentNoticeDetail extends ResidentNotice {
  content: string;
  contentJson: NoticeDoc | null;
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
  preview: row.preview ?? null,
});

const rowToNoticeDetail = (
  row: ResidentNoticeDetailRow,
): ResidentNoticeDetail => ({
  ...rowToNotice(row),
  content: row.content,
  contentJson: row.content_json ?? null,
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

export async function residentBuildingNotice(): Promise<string | null> {
  const { data, error } = await createClient().rpc("resident_building_notice");
  if (error) throw new Error(error.message);
  return typeof data === "string" && data.trim() ? data : null;
}
