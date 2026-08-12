import { createClient } from "@/lib/supabase/client";

export interface FeeItem {
  id: number; orgId: number; typeId: number; name: string; rounding: string;
  dailyProration: boolean; carryOver: boolean; isRequired: boolean; sortOrder: number;
}
export interface FeeItemInput {
  orgId: number; typeId: number; name: string; rounding: string;
  dailyProration: boolean; carryOver: boolean; isRequired: boolean; sortOrder?: number;
}

type FeeItemRow = {
  id: number; org_id: number; type_id: number; name: string; rounding: string;
  daily_proration: boolean; carry_over: boolean; is_required: boolean; sort_order: number;
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
  const sb = createClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await sb.from("fee_items").update({ sort_order: i }).eq("id", orderedIds[i]);
    if (error) throw new Error(error.message);
  }
}
