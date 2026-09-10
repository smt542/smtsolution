import { createClient } from "@/lib/supabase/client";

export type PublicSettlementKind = "환급" | "추가납부";

export interface PublicSettlementRow {
  move_out_date: string | null;
  settlement_kind: PublicSettlementKind | null;
  settlement_amount: number | null;
  unit_label: string | null;
  building_name: string | null;
  is_expired: boolean;
}

export interface PublicSettlement {
  moveOutDate: string | null;
  settlementKind: PublicSettlementKind | null;
  settlementAmount: number | null;
  unitLabel: string | null;
  buildingName: string | null;
  isExpired: boolean;
}

export type PublicSettlementByTokenResult = PublicSettlement | null;
export type MintSettlementShareTokenResult = string;

export async function mintSettlementShareToken(
  settlementId: number,
): Promise<MintSettlementShareTokenResult> {
  const { data, error } = await createClient().rpc(
    "mint_settlement_share_token",
    { p_settlement_id: settlementId },
  );
  if (error) throw new Error(error.message);
  if (typeof data !== "string") {
    throw new Error("정산 공유 링크를 만들지 못했습니다.");
  }
  return data;
}
