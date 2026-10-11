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

  // 파트너는 테이블을 직접 읽지 않는다(RLS가 사무실 직원만 허용). 담당 범위를 거르는 RPC만 쓴다.
  const supabase = await createClient();
  const [
    { data: occupancyData, error: occupancyError },
    { data: paymentData, error: paymentError },
    { data: settlementData, error: settlementError },
  ] = await Promise.all([
    supabase.rpc("partner_get_occupancy", { p_unit_id: unitId }),
    supabase.rpc("partner_list_unit_payments", { p_unit_id: unitId }),
    // 이사정산 카드 수납액(paid_amount) = 파트너 이사정산 등록 화면이 저장한 수납액(extra.paid).
    supabase.rpc("partner_list_unit_settlements", { p_unit_id: unitId }),
  ]);
  // 조회 실패를 "데이터 없음"으로 보여주지 않는다.
  const rpcError = occupancyError ?? paymentError ?? settlementError;
  if (rpcError) throw new Error(rpcError.message);

  const occupancy = ((Array.isArray(occupancyData) ? occupancyData[0] : occupancyData)
    ?? null) as OccupancyDetail | null;

  return {
    occupancy,
    payments: Array.isArray(paymentData)
      ? (paymentData as PaymentRow[]).map((p) => ({ ...p, late_fee_split_unpaid: p.late_fee_split_unpaid ?? 0 }))
      : [],
    settlements: Array.isArray(settlementData)
      ? (settlementData as MovingSettlement[]).map((s) => ({
          ...s,
          paid_amount: Number(s.paid_amount) || 0,
        }))
      : [],
  };
}
