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
  const [
    { data: occupancyData, error: occupancyError },
    { data: paymentData, error: paymentError },
    { data: settlementData, error: settlementError },
    { data: occupancyIdData },
    { data: settlementPaidData },
  ] = await Promise.all([
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
    // 이사정산 카드 수납액 = 파트너 이사정산 등록 화면이 저장한 수납액(extra.paid). 목록 RPC(0090)에는 없는 값이라
    // 따로 읽고, 화면에는 RPC가 돌려준(담당 건물) 정산에만 붙인다.
    supabase.from("moving_settlements").select("id, paid:extra->paid").eq("unit_id", unitId),
  ]);
  // 조회 실패를 "데이터 없음"으로 보여주지 않는다.
  const rpcError = occupancyError ?? paymentError ?? settlementError;
  if (rpcError) throw new Error(rpcError.message);

  const occupancy = ((Array.isArray(occupancyData) ? occupancyData[0] : occupancyData)
    ?? null) as OccupancyDetail | null;
  if (occupancy) {
    occupancy.occupancy_id = (occupancyIdData as { id: number } | null)?.id ?? null;
  }

  const paidById = new Map(
    ((settlementPaidData ?? []) as { id: number; paid: unknown }[]).map((row) => [row.id, Number(row.paid) || 0]),
  );

  return {
    occupancy,
    payments: Array.isArray(paymentData) ? paymentData as PaymentRow[] : [],
    settlements: Array.isArray(settlementData)
      ? (settlementData as Omit<MovingSettlement, "paid_amount">[]).map((s) => ({
          ...s,
          paid_amount: paidById.get(s.id) ?? 0,
        }))
      : [],
  };
}
