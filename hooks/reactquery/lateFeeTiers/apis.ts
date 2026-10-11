import { createClient } from "@/lib/supabase/client";

export interface LateFeeRateTier {
  id: number;
  orgId: number;
  tierOrder: number;
  fromMonth: number;
  toMonth: number | null;
  monthlyRate: number;
}

export interface LateFeeRateTierInput {
  tierOrder: number;
  fromMonth: number;
  toMonth: number | null;
  monthlyRate: number;
}

interface LateFeeRateTierRow {
  id: number;
  org_id: number;
  tier_order: number;
  from_month: number;
  to_month: number | null;
  monthly_rate: number | string;
}

export function rowToLateFeeRateTier(
  row: LateFeeRateTierRow,
): LateFeeRateTier {
  return {
    id: row.id,
    orgId: row.org_id,
    tierOrder: row.tier_order,
    fromMonth: row.from_month,
    toMonth: row.to_month,
    monthlyRate: Number(row.monthly_rate),
  };
}

export async function listLateFeeRateTiers(
  orgId: number,
): Promise<LateFeeRateTier[]> {
  const { data, error } = await createClient()
    .from("late_fee_rate_tiers")
    .select("*")
    .eq("org_id", orgId)
    .order("tier_order");

  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToLateFeeRateTier);
}

/** org 요율표 전체 교체: 서버 RPC 한 트랜잭션(삭제+삽입, settings 권한 검사). */
export async function replaceLateFeeRateTiers(
  orgId: number,
  tiers: LateFeeRateTierInput[],
): Promise<void> {
  const { error } = await createClient().rpc("replace_late_fee_rate_tiers", {
    p_org_id: orgId,
    p_tiers: tiers.map((tier) => ({
      tierOrder: tier.tierOrder,
      fromMonth: tier.fromMonth,
      toMonth: tier.toMonth,
      monthlyRate: tier.monthlyRate,
    })),
  });

  if (error) throw new Error(error.message);
}
