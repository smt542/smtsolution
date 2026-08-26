import { createClient } from "@/lib/supabase/client";

export interface BuildingType { id: number; orgId: number; label: string; sortOrder: number; }
export interface BuildingTypeInput { orgId: number; label: string; sortOrder?: number; }

type BuildingTypeRow = { id: number; org_id: number; label: string; sort_order: number };

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
  const { data, error } = await createClient().from("building_types").insert(inputToRow(input)).select().single();
  if (error) throw new Error(error.message);
  return rowToBuildingType(data);
}

export async function renameBuildingType(id: number, label: string): Promise<BuildingType> {
  const { data, error } = await createClient().from("building_types").update({ label }).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return rowToBuildingType(data);
}

export async function deleteBuildingType(id: number): Promise<void> {
  const { error } = await createClient().from("building_types").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function reorderBuildingTypes(orderedIds: number[]): Promise<void> {
  const { error } = await createClient().rpc("reorder_building_types", {
    p_ordered_ids: orderedIds,
  });
  if (error) throw new Error(error.message);
}
