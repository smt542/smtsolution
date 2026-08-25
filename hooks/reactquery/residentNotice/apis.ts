import { createClient } from "@/lib/supabase/client";

export type PublicNoticeType = "normal" | "important" | "urgent";

export interface PublicNoticeRow {
  title: string | null;
  content: string | null;
  notice_type: PublicNoticeType | null;
  building_name: string | null;
  published_at: string | null;
  is_expired: boolean;
}

export interface PublicNotice {
  title: string | null;
  content: string | null;
  noticeType: PublicNoticeType | null;
  buildingName: string | null;
  publishedAt: string | null;
  isExpired: boolean;
}

export type PublicNoticeByTokenResult = PublicNotice | null;
export type MintNoticeShareTokenResult = string;

const rowToPublicNotice = (row: PublicNoticeRow): PublicNotice => ({
  title: row.title,
  content: row.content,
  noticeType: row.notice_type,
  buildingName: row.building_name,
  publishedAt: row.published_at,
  isExpired: row.is_expired,
});

export async function publicNoticeByToken(
  token: string,
): Promise<PublicNoticeByTokenResult> {
  const { data, error } = await createClient().rpc("public_notice_by_token", {
    p_token: token,
  });
  if (error) throw new Error(error.message);
  return data ? rowToPublicNotice(data as PublicNoticeRow) : null;
}

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
