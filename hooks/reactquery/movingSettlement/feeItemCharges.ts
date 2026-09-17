import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useFeeItems, type FeeItem } from "@/hooks/reactquery/feeItems";
import { roundCharge, type Rounding } from "@/lib/billing/proration";

export async function listUnitFeeItemCharges(
  unitId: number,
  period: string,
): Promise<Record<number, number>> {
  const { data, error } = await createClient()
    .from("fee_item_charges")
    .select("fee_item_id, amount")
    .eq("unit_id", unitId)
    .eq("period", period)
    .eq("charged", true);

  if (error) throw new Error(error.message);

  const charges: Record<number, number> = {};
  for (const row of data ?? []) {
    charges[row.fee_item_id] = row.amount;
  }
  return charges;
}

export function useUnitFeeItemCharges(
  unitId: number | null,
  period: string | null,
) {
  return useQuery({
    queryKey: ["movingSettlement", "feeItemCharges", unitId, period],
    queryFn: () =>
      listUnitFeeItemCharges(unitId as number, period as string),
    enabled: unitId !== null && period !== null,
  });
}

export interface ManagementFeeRow {
  item: FeeItem;
  /** 그 달 부과액 */
  charge: number;
  /** 일할/반올림 적용 정산액. 정본 헤더의 "정산액(일할 자동)" */
  settlement: number;
}

/**
 * 관리비 항목(건물 유형별 fee_items)과 그 세대의 당월 부과액을 합쳐
 * 항목별 정산액까지 계산한다. 폼 섹션과 요약바가 같은 숫자를 쓰도록
 * 한 곳에서만 계산한다(React Query 가 같은 키를 dedupe 하므로 호출은 1회다).
 */
export function useManagementFeeRows(
  buildingTypeId: number | null,
  unitId: number | null,
  moveOutDate: string,
): { rows: ManagementFeeRow[]; subtotal: number; isLoading: boolean } {
  const feeItemsQuery = useFeeItems(buildingTypeId ?? 0);
  const period = moveOutDate ? `${moveOutDate.slice(0, 7)}-01` : null;
  const chargesQuery = useUnitFeeItemCharges(unitId, period);

  // 일할 분모는 그 달 일수와 무관하게 고정 30일이다(계산규칙 1.1).
  const chargeDays = Number(moveOutDate.slice(8, 10)) || 0;
  const charges = chargesQuery.data ?? {};
  const rows = [...(feeItemsQuery.data ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => {
      const charge = charges[item.id] ?? 0;
      const settlement = item.dailyProration
        ? roundCharge((charge * chargeDays) / 30, item.rounding as Rounding)
        : charge;
      return { item, charge, settlement };
    });

  return {
    rows,
    subtotal: rows.reduce((sum, row) => sum + row.settlement, 0),
    isLoading: feeItemsQuery.isLoading || chargesQuery.isLoading,
  };
}
