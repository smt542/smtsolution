import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Building = {
  id: number;
  code: string;
  name: string;
  address: string | null;
  memo: string | null;
  building_type: string | null;
  entrance_password: string | null;
  owner_name: string | null;
  owner_phone: string | null;
};

export type Unit = {
  unit_id: number;
  unit_no: string;
  dong: string | null;
  tenant_name: string | null;
  phone: string | null;
  move_in_date: string | null;
  status: string;
};

export type Vendor = {
  id: number;
  vendor_type: string;
  name: string;
  phone: string | null;
  memo: string | null;
};

export type PartnerBuildingPageData = {
  building: Building | null;
  units: Unit[];
  vendors: Vendor[];
};

export async function getPartnerBuildingPageData(
  buildingId: number,
): Promise<PartnerBuildingPageData> {
  const supabase = await createClient();
  const [
    { data: buildingData, error: buildingError },
    { data: unitsData, error: unitsError },
    { data: vendorsData, error: vendorsError },
  ] = await Promise.all([
    supabase.rpc("partner_get_building", { p_building_id: buildingId }),
    supabase.rpc("partner_list_units", { p_building_id: buildingId }),
    supabase.rpc("partner_list_building_vendors", {
      p_building_id: buildingId,
    }),
  ]);
  // 조회 실패를 "데이터 없음"으로 보여주지 않는다.
  const error = buildingError ?? unitsError ?? vendorsError;
  if (error) throw new Error(error.message);

  return {
    building:
      ((Array.isArray(buildingData) ? buildingData[0] : buildingData) as
        | Building
        | null) ?? null,
    units: Array.isArray(unitsData) ? (unitsData as Unit[]) : [],
    vendors: Array.isArray(vendorsData) ? (vendorsData as Vendor[]) : [],
  };
}
