import { createClient } from "@/lib/supabase/client";

import type { NoticeDoc } from "@/lib/notice/richText";

export type NoticeType = "normal" | "important" | "urgent";
export type NoticeStatus = "all" | "draft" | "scheduled" | "published" | "expired";

export interface Notice {
  id: number;
  orgId: number;
  buildingId: number | null;
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
  buildingId: number | null;
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
  /** undefined = 전체, null = 전체 공지, number = 해당 건물 */
  buildingId?: number | null;
  noticeType?: NoticeType;
  status?: NoticeStatus;
  search?: string;
}

interface NoticeRow {
  id: number;
  org_id: number;
  building_id: number | null;
  title: string;
  content: string;
  content_json: NoticeDoc | null;
  notice_type: NoticeType;
  published_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

type NoticeSummaryRow = Omit<NoticeRow, "content" | "content_json">;

const rowToNotice = (row: NoticeRow): Notice => ({
  id: row.id,
  orgId: row.org_id,
  buildingId: row.building_id,
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
  buildingId: row.building_id,
  title: row.title,
  noticeType: row.notice_type,
  publishedAt: row.published_at,
  expiresAt: row.expires_at,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

function inputToRow(input: Partial<NoticeInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value;
  };

  set("org_id", input.orgId);
  set("building_id", input.buildingId);
  set("title", input.title);
  set("content", input.content);
  set("content_json", input.contentJson);
  set("notice_type", input.noticeType);
  set("published_at", input.publishedAt);
  set("expires_at", input.expiresAt);
  set("created_by", input.createdBy);
  return row;
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
      "id, org_id, building_id, title, notice_type, published_at, expires_at, created_by, created_at, updated_at",
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (filters.buildingId === null) {
    query = query.is("building_id", null);
  } else if (typeof filters.buildingId === "number") {
    query = query.eq("building_id", filters.buildingId);
  }

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
    .select("*")
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
  return rowToNotice(data as NoticeRow);
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
    .select()
    .single();

  if (error) throw new Error(error.message);
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
