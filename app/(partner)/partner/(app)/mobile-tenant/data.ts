import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  MobileTenantData,
  MovingSettlement,
  OccupancyDetail,
  PaymentRow,
} from "./types";

export async function getMobileTenantData(unitId: number | null): Promise<MobileTenantData> {
  if (unitId === null) {
    return { occupancy: null, payments: [], settlements: [] };
  }

  const supabase = await createClient();
  const [{ data: occupancyData }, { data: paymentData }, { data: settlementData }, { data: occupancyIdData }] =
    await Promise.all([
      supabase.rpc("partner_get_occupancy", { p_unit_id: unitId }),
      supabase.rpc("partner_list_unit_payments", { p_unit_id: unitId }),
      supabase.rpc("partner_list_unit_settlements", { p_unit_id: unitId }),
      supabase
        .from("occupancies")
        .select("id")
        .eq("unit_id", unitId)
        .is("deleted_at", null)
        .eq("status", "occupied")
        .maybeSingle(),
    ]);

  const occupancy = ((Array.isArray(occupancyData) ? occupancyData[0] : occupancyData)
    ?? null) as OccupancyDetail | null;
  if (occupancy) {
    occupancy.occupancy_id = (occupancyIdData as { id: number } | null)?.id ?? null;
  }

  return {
    occupancy,
    payments: Array.isArray(paymentData) ? paymentData as PaymentRow[] : [],
    settlements: Array.isArray(settlementData)
      ? settlementData as MovingSettlement[]
      : [],
  };
}
