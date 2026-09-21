import { createClient } from "@/lib/supabase/client";
import { AppError } from "@/hooks/common/useAppToast";

export interface BuildingType { id: number; orgId: number; label: string; sortOrder: number; }
export interface BuildingTypeInput { orgId: number; label: string; sortOrder?: number; }

type BuildingTypeRow = { id: number; org_id: number; label: string; sort_order: number };

// building_types 는 UNIQUE (org_id, label) 이라 같은 이름을 두 번 만들 수 없다.
export const DUPLICATE_BUILDING_TYPE_LABEL = "이미 있는 유형명입니다. 다른 이름을 입력해 주세요.";

function toLabelError(error: { code?: string; message: string }): Error & { code?: string } {
  const result = error.code === "23505"
    ? new AppError(DUPLICATE_BUILDING_TYPE_LABEL)
    : new Error(error.message);
  return Object.assign(result, { code: error.code });
}

const rowToBuildingType = (r: BuildingTypeRow): BuildingType => ({
  id: r.id, orgId: r.org_id, label: r.label, sortOrder: r.sort_order,
});

function inputToRow(i: Partial<BuildingTypeInput>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => { if (v !== undefined) r[k] = v; };
  set("org_id", i.orgId); set("label", i.label); set("sort_order", i.sortOrder);
  return r;
}

export async function listBuildingTypes(): Promise<BuildingType[]> {
  const { data, error } = await createClient().from("building_types").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToBuildingType);
}

export async function createBuildingType(input: BuildingTypeInput): Promise<BuildingType> {
  // 필수 항목(전기·수도료·가스)은 building_types_seed_required_utility_fee_items 트리거가 함께 만든다.
  const { data, error } = await createClient().from("building_types").insert(inputToRow(input)).select().single();
  if (error) throw toLabelError(error);
  return rowToBuildingType(data);
}

export async function renameBuildingType(id: number, label: string): Promise<BuildingType> {
  const { data, error } = await createClient().from("building_types").update({ label }).eq("id", id).select().single();
  if (error) throw toLabelError(error);
  return rowToBuildingType(data);
}

export async function getBuildingTypeUsage(id: number): Promise<{ buildings: boolean; billing: boolean }> {
  const client = createClient();
  const [buildingsResult, feeItemsResult] = await Promise.all([
    client.from("buildings").select("id").eq("type_id", id).limit(1),
    client.from("fee_items").select("id").eq("type_id", id),
  ]);
  if (buildingsResult.error) throw new Error(buildingsResult.error.message);
  if (feeItemsResult.error) throw new Error(feeItemsResult.error.message);

  const feeItemIds = (feeItemsResult.data ?? []).map((item) => item.id as number);
  if (feeItemIds.length === 0) {
    return { buildings: (buildingsResult.data ?? []).length > 0, billing: false };
  }
  const chargesResult = await client
    .from("fee_item_charges")
    .select("id")
    .in("fee_item_id", feeItemIds)
    .limit(1);
  if (chargesResult.error) throw new Error(chargesResult.error.message);
  return {
    buildings: (buildingsResult.data ?? []).length > 0,
    billing: (chargesResult.data ?? []).length > 0,
  };
}

export async function deleteBuildingType(id: number): Promise<void> {
  const usage = await getBuildingTypeUsage(id);
  if (usage.buildings || usage.billing) {
    throw new Error("건물 또는 부과 내역에 사용 중인 유형은 삭제할 수 없습니다.");
  }
  const { error } = await createClient().from("building_types").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function reorderBuildingTypes(orderedIds: number[]): Promise<void> {
  const { error } = await createClient().rpc("reorder_building_types", {
    p_ordered_ids: orderedIds,
  });
  if (error) throw new Error(error.message);
}
