import { createClient } from "@/lib/supabase/client";
import { AppError } from "@/hooks/common/useAppToast";
import { REQUIRED_FEE_ITEM_NAMES } from "../feeItems/apis";

export interface BuildingType { id: number; orgId: number; label: string; sortOrder: number; }
export interface BuildingTypeInput { orgId: number; label: string; sortOrder?: number; }

type BuildingTypeRow = { id: number; org_id: number; label: string; sort_order: number };

// building_types 는 UNIQUE (org_id, label) 이라 같은 이름을 두 번 만들 수 없다.
export const DUPLICATE_BUILDING_TYPE_LABEL = "이미 있는 유형명입니다. 다른 이름을 입력해 주세요.";

/** 유형은 만들어졌지만 필수 항목 시딩만 실패한 경우. 유형 자체는 유효하므로 UI가 구분해서 처리한다. */
export class BuildingTypeSeedError extends AppError {
  constructor(public readonly created: BuildingType, cause?: string) {
    super(
      "유형은 추가됐지만 필수 항목을 만들지 못했습니다. 항목을 눌러 다시 저장해 주세요.",
      cause ? { cause: new Error(cause) } : undefined,
    );
    this.name = "BuildingTypeSeedError";
  }
}

function toLabelError(error: { code?: string; message: string }): Error {
  return error.code === "23505" ? new AppError(DUPLICATE_BUILDING_TYPE_LABEL) : new Error(error.message);
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
  const client = createClient();
  const { data, error } = await client.from("building_types").insert(inputToRow(input)).select().single();
  if (error) throw toLabelError(error);
  const created = rowToBuildingType(data);

  // 필수 항목은 유형과 함께 존재해야 하므로 화면 조작과 무관하게 생성 시점에 같이 넣는다.
  const { error: requiredError } = await client.from("fee_items").insert(
    REQUIRED_FEE_ITEM_NAMES.map((name, index) => ({
      org_id: created.orgId,
      type_id: created.id,
      name,
      rounding: "round",
      daily_proration: true,
      carry_over: true,
      is_required: true,
      sort_order: index,
    })),
  );
  if (requiredError) throw new BuildingTypeSeedError(created, requiredError.message);

  return created;
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
