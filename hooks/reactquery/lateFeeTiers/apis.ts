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

/** org 요율표 전체 교체: 기존 삭제 후 신규 삽입. */
export async function replaceLateFeeRateTiers(
  orgId: number,
  tiers: LateFeeRateTierInput[],
): Promise<void> {
  const client = createClient();
  const deletion = await client
    .from("late_fee_rate_tiers")
    .delete()
    .eq("org_id", orgId);

  if (deletion.error) throw new Error(deletion.error.message);
  if (tiers.length === 0) return;

  const rows = tiers.map((tier) => ({
    org_id: orgId,
    tier_order: tier.tierOrder,
    from_month: tier.fromMonth,
    to_month: tier.toMonth,
    monthly_rate: tier.monthlyRate,
  }));
  const insertion = await client.from("late_fee_rate_tiers").insert(rows);

  if (insertion.error) throw new Error(insertion.error.message);
}
