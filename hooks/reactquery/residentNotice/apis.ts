import { createClient } from "@/lib/supabase/client";

import type { NoticeDoc } from "@/lib/notice/richText";

export type PublicNoticeType = "normal" | "important" | "urgent";

export interface PublicNoticeRow {
  title: string | null;
  content: string | null;
  content_json: NoticeDoc | null;
  notice_type: PublicNoticeType | null;
  building_name: string | null;
  published_at: string | null;
  is_expired: boolean;
}

export interface PublicNotice {
  title: string | null;
  content: string | null;
  contentJson: NoticeDoc | null;
  noticeType: PublicNoticeType | null;
  buildingName: string | null;
  publishedAt: string | null;
  isExpired: boolean;
}

export type PublicNoticeByTokenResult = PublicNotice | null;
export type MintNoticeShareTokenResult = string;

export async function mintNoticeShareToken(
  noticeId: number,
): Promise<MintNoticeShareTokenResult> {
  const { data, error } = await createClient().rpc("mint_notice_share_token", {
    p_notice_id: noticeId,
  });
  if (error) throw new Error(error.message);
  if (typeof data !== "string") {
    throw new Error("공지 공유 링크를 만들지 못했습니다.");
  }
  return data;
}
