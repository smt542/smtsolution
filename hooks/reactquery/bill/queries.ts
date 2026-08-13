import { useQuery } from "@tanstack/react-query";
import { listBillTargets, getBillDocuments } from "./apis";
import { billKeys } from "./keys";

export function useBillTargets(buildingId: number | null, period: string) {
  return useQuery({
    queryKey: billKeys.targets(buildingId ?? 0, period),
    queryFn: () => listBillTargets(buildingId as number, period),
    enabled: !!buildingId,
  });
}

export function useBillDocuments(buildingId: number | null, period: string, unitIds: number[]) {
  return useQuery({
    queryKey: billKeys.documents(buildingId ?? 0, period, unitIds),
    queryFn: () => getBillDocuments(buildingId as number, period, unitIds),
    enabled: !!buildingId && unitIds.length > 0,
  });
}
