import { useQuery } from "@tanstack/react-query";
import { getLedgerOpeningBalance, listLedgerByBuilding } from "./apis";
import { longTermRepairKeys } from "./keys";

export function useLongTermRepairLedger(
  buildingId: number | null | undefined,
  startMonth: string,
  endMonth: string,
) {
  return useQuery({
    queryKey: longTermRepairKeys.byBuilding(buildingId ?? 0, startMonth, endMonth),
    queryFn: () => listLedgerByBuilding(buildingId as number, startMonth, endMonth),
    enabled: !!buildingId && startMonth <= endMonth,
  });
}

export function useLongTermRepairOpeningBalance(
  buildingId: number | null | undefined,
  startMonth: string,
) {
  return useQuery({
    queryKey: longTermRepairKeys.openingBalance(buildingId ?? 0, startMonth),
    queryFn: () => getLedgerOpeningBalance(buildingId as number, startMonth),
    enabled: !!buildingId,
  });
}
