// hooks/reactquery/buildingVendors/apis.ts
import { createClient } from "@/lib/supabase/client";

export type VendorType = "elevator" | "fire" | "electric" | "septic" | "etc";

export interface BuildingVendor {
  id: number;
  buildingId: number;
  vendorType: VendorType;
  name: string;
  phone: string | null;
  memo: string | null;
  sortOrder: number;
}

export const toBuildingVendor = (r: any): BuildingVendor => ({
  id: r.id, buildingId: r.building_id, vendorType: r.vendor_type,
  name: r.name, phone: r.phone, memo: r.memo, sortOrder: r.sort_order,
});

export async function listBuildingVendorsByBuilding(buildingId: number): Promise<BuildingVendor[]> {
  const { data, error } = await createClient()
    .from("building_vendors")
    .select("*")
    .eq("building_id", buildingId)
    .is("deleted_at", null)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map(toBuildingVendor);
}
