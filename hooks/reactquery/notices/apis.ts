import { createClient } from "@/lib/supabase/client";

export type NoticeType = "normal" | "important" | "urgent";
export type NoticeStatus = "all" | "draft" | "scheduled" | "published" | "expired";

export interface Notice {
  id: number;
  orgId: number;
  buildingId: number | null;
  title: string;
  content: string;
  noticeType: NoticeType;
  publishedAt: string | null;
  expiresAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoticeInput {
  orgId: number;
  buildingId: number | null;
  title: string;
  content: string;
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
  notice_type: NoticeType;
  published_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const rowToNotice = (row: NoticeRow): Notice => ({
  id: row.id,
  orgId: row.org_id,
  buildingId: row.building_id,
  title: row.title,
  content: row.content,
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
  set("notice_type", input.noticeType);
  set("published_at", input.publishedAt);
  set("expires_at", input.expiresAt);
  set("created_by", input.createdBy);
  return row;
}

function safeSearchTerm(search: string): string {
  return search.trim().replace(/[,().%]/g, " ");
}

export async function listNotices(filters: NoticeFilters = {}): Promise<Notice[]> {
  const now = new Date().toISOString();
  let query = createClient()
    .from("notices")
    .select("*")
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

  const { data, error } = await query
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as NoticeRow[]).map(rowToNotice);
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
