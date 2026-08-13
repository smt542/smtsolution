import { useQuery } from "@tanstack/react-query";
import { getSettlementContext, listSettlements } from "./apis";
import { movingSettlementKeys } from "./keys";

export function useSettlementContext(unitId: number | null) {
  return useQuery({
    queryKey: movingSettlementKeys.context(unitId),
    queryFn: () => getSettlementContext(unitId as number),
    enabled: unitId !== null,
  });
}

export function useSettlementList(
  buildingId: number | null,
  from: string,
  to: string,
) {
  return useQuery({
    queryKey: movingSettlementKeys.list(buildingId, from, to),
    queryFn: () => listSettlements(buildingId as number, from, to),
    enabled: buildingId !== null && from !== "" && to !== "",
  });
}
