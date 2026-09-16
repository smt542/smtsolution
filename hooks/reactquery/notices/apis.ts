import { createClient } from "@/lib/supabase/client";

import type { NoticeDoc } from "@/lib/notice/richText";

export type NoticeType = "normal" | "important" | "urgent";
export type NoticeStatus = "all" | "draft" | "scheduled" | "published" | "expired";

export interface Notice {
  id: number;
  orgId: number;
  /** 대상 건물 id 목록. 빈 배열 = 전체(org-wide) 공지. */
  buildingIds: number[];
  title: string;
  /** 평문 투영. 목록 검색·미리보기·문자 등 기존 소비 경로 호환용. */
  content: string;
  /** Tiptap JSON 원본. null이면 레거시 plain text만 존재. */
  contentJson: NoticeDoc | null;
  noticeType: NoticeType;
  publishedAt: string | null;
  expiresAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NoticeSummary = Omit<Notice, "content" | "contentJson">;

export interface NoticePage {
  items: NoticeSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export const NOTICE_PAGE_SIZE = 20;

export interface NoticeInput {
  orgId: number;
  /** 대상 건물 id 목록. 빈 배열 = 전체 공지. */
  buildingIds: number[];
  title: string;
  /** 평문 투영(NOT NULL 컬럼). Tiptap 문서에서 파생한다. */
  content: string;
  /** Tiptap JSON 원본. */
  contentJson?: NoticeDoc | null;
  noticeType: NoticeType;
  publishedAt: string | null;
  expiresAt: string | null;
  createdBy?: string | null;
}

export interface NoticeFilters {
  noticeType?: NoticeType;
  status?: NoticeStatus;
  search?: string;
}

interface NoticeBuildingLinkRow {
  building_id: number;
}

interface NoticeRow {
  id: number;
  org_id: number;
  title: string;
  content: string;
  content_json: NoticeDoc | null;
  notice_type: NoticeType;
  published_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  notice_buildings?: NoticeBuildingLinkRow[] | null;
}

type NoticeSummaryRow = Omit<NoticeRow, "content" | "content_json">;

const linkBuildingIds = (row: { notice_buildings?: NoticeBuildingLinkRow[] | null }): number[] =>
  (row.notice_buildings ?? []).map((link) => link.building_id);

const rowToNotice = (row: NoticeRow): Notice => ({
  id: row.id,
  orgId: row.org_id,
  buildingIds: linkBuildingIds(row),
  title: row.title,
  content: row.content,
  contentJson: row.content_json ?? null,
  noticeType: row.notice_type,
  publishedAt: row.published_at,
  expiresAt: row.expires_at,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const rowToNoticeSummary = (row: NoticeSummaryRow): NoticeSummary => ({
  id: row.id,
  orgId: row.org_id,
  buildingIds: linkBuildingIds(row),
  title: row.title,
  noticeType: row.notice_type,
  publishedAt: row.published_at,
  expiresAt: row.expires_at,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** notices 테이블 컬럼만 매핑한다(building_id는 레거시라 쓰지 않는다). */
function inputToRow(input: Partial<NoticeInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value;
  };

  set("org_id", input.orgId);
  set("title", input.title);
  set("content", input.content);
  set("content_json", input.contentJson);
  set("notice_type", input.noticeType);
  set("published_at", input.publishedAt);
  set("expires_at", input.expiresAt);
  set("created_by", input.createdBy);
  return row;
}

/**
 * 공지의 대상 건물 링크를 목표 집합과 일치시킨다(추가분 upsert → 이외 삭제).
 * 빈 배열이면 모든 링크 삭제 = 전체 공지. org_id는 트리거가 공지 org로 채운다.
 */
async function setNoticeBuildings(noticeId: number, buildingIds: number[]): Promise<void> {
  const client = createClient();
  const desired = Array.from(new Set(buildingIds));

  if (desired.length > 0) {
    const { error } = await client
      .from("notice_buildings")
      .upsert(
        desired.map((buildingId) => ({ notice_id: noticeId, building_id: buildingId })),
        { onConflict: "notice_id,building_id", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
  }

  let deletion = client.from("notice_buildings").delete().eq("notice_id", noticeId);
  if (desired.length > 0) {
    deletion = deletion.not("building_id", "in", `(${desired.join(",")})`);
  }
  const { error } = await deletion;
  if (error) throw new Error(error.message);
}

function safeSearchTerm(search: string): string {
  return search.trim().replace(/[,().%]/g, " ");
}

export async function listNotices(
  filters: NoticeFilters = {},
  page = 0,
  pageSize = NOTICE_PAGE_SIZE,
): Promise<NoticePage> {
  const now = new Date().toISOString();
  const firstRow = Math.max(0, page) * pageSize;
  let query = createClient()
    .from("notices")
    .select(
      "id, org_id, title, notice_type, published_at, expires_at, created_by, created_at, updated_at, notice_buildings(building_id)",
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (filters.noticeType) query = query.eq("notice_type", filters.noticeType);

  switch (filters.status) {
    case "draft":
      query = query.is("published_at", null);
      break;
    case "scheduled":
      query = query.gt("published_at", now);
      break;
    case "published":
      query = query
        .lte("published_at", now)
        .or(`expires_at.is.null,expires_at.gt.${now}`);
      break;
    case "expired":
      query = query.lte("expires_at", now);
      break;
  }

  const search = filters.search ? safeSearchTerm(filters.search) : "";
  if (search) query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);

  const { data, error, count } = await query
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(firstRow, firstRow + pageSize - 1);

  if (error) throw new Error(error.message);
  const items = ((data ?? []) as NoticeSummaryRow[]).map(rowToNoticeSummary);
  return {
    items,
    total: count ?? items.length,
    page: Math.max(0, page),
    pageSize,
  };
}

export async function getNotice(id: number): Promise<Notice> {
  const { data, error } = await createClient()
    .from("notices")
    .select("*, notice_buildings(building_id)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) throw new Error(error.message);
  return rowToNotice(data as NoticeRow);
}

export async function createNotice(input: NoticeInput): Promise<Notice> {
  const { data, error } = await createClient()
    .from("notices")
    .insert(inputToRow(input))
    .select()
    .single();

  if (error) throw new Error(error.message);
  const desired = Array.from(new Set(input.buildingIds));
  await setNoticeBuildings((data as NoticeRow).id, desired);
  return { ...rowToNotice(data as NoticeRow), buildingIds: desired };
}

export async function updateNotice(
  id: number,
  input: Partial<NoticeInput>,
): Promise<Notice> {
  const { data, error } = await createClient()
    .from("notices")
    .update(inputToRow(input))
    .eq("id", id)
    .is("deleted_at", null)
    .select("*, notice_buildings(building_id)")
    .single();

  if (error) throw new Error(error.message);
  if (input.buildingIds !== undefined) {
    const desired = Array.from(new Set(input.buildingIds));
    await setNoticeBuildings(id, desired);
    return { ...rowToNotice(data as NoticeRow), buildingIds: desired };
  }
  return rowToNotice(data as NoticeRow);
}

/** 이력 보존을 위해 물리 삭제하지 않고 deleted_at만 기록한다. */
export async function deleteNotice(id: number): Promise<void> {
  const { error } = await createClient()
    .from("notices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
}

export interface NoticeSendSummary {
  /** 최근 발송의 수신자 수. */
  count: number;
  sentAt: string;
  /** message_logs.result: 'stub' | 'sent' | 'failed' | 'queued' 등. */
  result: string;
}

interface NoticeSendSummaryRow {
  recipient_count: number;
  sent_at: string;
  result: string;
}

/** 공지의 최근 발송 1건 요약(없으면 null). */
export async function getNoticeSendSummary(noticeId: number): Promise<NoticeSendSummary | null> {
  const { data, error } = await createClient().rpc("notice_send_summary", {
    p_notice_id: noticeId,
  });
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as NoticeSendSummaryRow[])[0];
  if (!row) return null;
  return { count: row.recipient_count, sentAt: row.sent_at, result: row.result };
}

/** 발송 로그(log_id)를 공지에 귀속시킨다(발송 완료 후 호출). */
export async function attachNoticeSendLog(logId: number, noticeId: number): Promise<void> {
  const { error } = await createClient().rpc("attach_notice_to_message_log", {
    p_log_id: logId,
    p_notice_id: noticeId,
  });
  if (error) throw new Error(error.message);
}
