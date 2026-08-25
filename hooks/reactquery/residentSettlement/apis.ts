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

const rowToPublicSettlement = (
  row: PublicSettlementRow,
): PublicSettlement => ({
  moveOutDate: row.move_out_date,
  settlementKind: row.settlement_kind,
  settlementAmount: row.settlement_amount,
  unitLabel: row.unit_label,
  buildingName: row.building_name,
  isExpired: row.is_expired,
});

export async function publicSettlementByToken(
  token: string,
): Promise<PublicSettlementByTokenResult> {
  const { data, error } = await createClient().rpc(
    "public_settlement_by_token",
    { p_token: token },
  );
  if (error) throw new Error(error.message);
  return data ? rowToPublicSettlement(data as PublicSettlementRow) : null;
}

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
