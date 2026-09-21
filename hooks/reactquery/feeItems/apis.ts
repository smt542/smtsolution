import { createClient } from "@/lib/supabase/client";

// 모든 건물 유형이 반드시 보유해야 하는 공과금 항목.
export const REQUIRED_FEE_ITEM_NAMES = ["전기", "수도료", "가스"] as const;

export interface FeeItem {
  id: number; orgId: number; typeId: number; name: string; rounding: string;
  dailyProration: boolean; carryOver: boolean; isRequired: boolean; sortOrder: number;
}
export interface FeeItemInput {
  orgId: number; typeId: number; name: string; rounding: string;
  dailyProration: boolean; carryOver: boolean; isRequired: boolean; sortOrder?: number;
}

export interface FeeItemLookupFilters {
  typeId?: number | null;
  required?: boolean | null;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface FeeItemLookupResult {
  rows: FeeItemLookupRow[];
  total: number;
}

export interface FeeItemLookupRow {
  id: number;
  typeId: number;
  typeLabel: string;
  name: string;
  rounding: string;
  dailyProration: boolean;
  carryOver: boolean;
  isRequired: boolean;
  sortOrder: number;
}

type FeeItemRow = {
  id: number; org_id: number; type_id: number; name: string; rounding: string;
  daily_proration: boolean; carry_over: boolean; is_required: boolean; sort_order: number;
};

type FeeItemLookupDbRow = {
  id: number;
  type_id: number;
  name: string;
  rounding: string;
  daily_proration: boolean;
  carry_over: boolean;
  is_required: boolean;
  sort_order: number;
  building_types: { label: string } | null;
};

const rowToFeeItem = (r: FeeItemRow): FeeItem => ({
  id: r.id, orgId: r.org_id, typeId: r.type_id, name: r.name, rounding: r.rounding,
  dailyProration: r.daily_proration, carryOver: r.carry_over, isRequired: r.is_required, sortOrder: r.sort_order,
});

function inputToRow(i: Partial<FeeItemInput>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => { if (v !== undefined) r[k] = v; };
  set("org_id", i.orgId); set("type_id", i.typeId); set("name", i.name); set("rounding", i.rounding);
  set("daily_proration", i.dailyProration); set("carry_over", i.carryOver);
  set("is_required", i.isRequired); set("sort_order", i.sortOrder);
  return r;
}

export async function listFeeItems(typeId: number): Promise<FeeItem[]> {
  const { data, error } = await createClient().from("fee_items").select("*").eq("type_id", typeId).is("deleted_at", null).order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToFeeItem);
}

/** 항목등록 관리 화면에서 유형별 초안을 구성하기 위한 전체 활성 항목 목록. */
export async function listFeeItemsForManagement(): Promise<FeeItem[]> {
  const { data, error } = await createClient()
    .from("fee_items")
    .select("*")
    .is("deleted_at", null)
    .order("type_id")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToFeeItem);
}

export async function listAllFeeItems(
  filters: FeeItemLookupFilters,
): Promise<FeeItemLookupResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));
  const firstRow = (page - 1) * pageSize;
  let query = createClient()
    .from("fee_items")
    .select(
      "id, type_id, name, rounding, daily_proration, carry_over, is_required, sort_order, building_types!inner(id, label)",
      { count: "exact" },
    )
    .is("deleted_at", null);
  if (filters.typeId != null) query = query.eq("type_id", filters.typeId);
  if (filters.required != null) query = query.eq("is_required", filters.required);
  const q = filters.q?.trim();
  if (q) query = query.ilike("name", `%${q}%`);
  const { data, count, error } = await query
    .order("type_id")
    .order("sort_order")
    .range(firstRow, firstRow + pageSize - 1);
  if (error) throw new Error(error.message);
  return {
    rows: ((data ?? []) as unknown as FeeItemLookupDbRow[]).map((r) => ({
      id: r.id,
      typeId: r.type_id,
      typeLabel: r.building_types?.label ?? "",
      name: r.name,
      rounding: r.rounding,
      dailyProration: r.daily_proration,
      carryOver: r.carry_over,
      isRequired: r.is_required,
      sortOrder: r.sort_order,
    })),
    total: count ?? 0,
  };
}

export async function createFeeItem(input: FeeItemInput): Promise<FeeItem> {
  const { data, error } = await createClient().from("fee_items").insert(inputToRow(input)).select().single();
  if (error) throw new Error(error.message);
  return rowToFeeItem(data);
}

export async function updateFeeItem(id: number, input: Partial<FeeItemInput>): Promise<FeeItem> {
  const { data, error } = await createClient().from("fee_items").update(inputToRow(input)).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return rowToFeeItem(data);
}

// 소프트삭제: 필수 항목은 거부, 그 외엔 deleted_at 세팅(부과 이력 보존)
export async function deleteFeeItem({ id, isRequired }: { id: number; isRequired: boolean }): Promise<void> {
  if (isRequired) throw new Error("필수 항목은 삭제할 수 없습니다");
  const { error } = await createClient().from("fee_items").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function reorderFeeItems(orderedIds: number[]): Promise<void> {
  const { error } = await createClient().rpc("reorder_fee_items", {
    p_ordered_ids: orderedIds,
  });
  if (error) throw new Error(error.message);
}
